'use strict';
// module 読み込み
const {google} = require('googleapis');
const async = require('async');
const mysql = require('mysql');
const _ = require('underscore');
const Slack = require('slack-node');
require('date-utils');
require('dotenv').config();

// Object生成
const CalendarId = process.env.CALENDAR_ID;
const webhookUri = process.env.WEBHOOK_URI;
const privatekey = require('./privatekey.json');
const connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : process.env.DB_NAME
});
let today = new Date().clearTime();
let tomorrow = new Date().add({days:1}).clearTime();
const sleepTime = 1000;

(function() {
  //TODO どのアカウントで情報を更新するか定義
  Promise.resolve()
  .then(function(){
    return new Promise(function(resolve, reject){
      //JWT auth clientの設定
      const jwtClient = new google.auth.JWT(
        privatekey.client_email,
        null,
        privatekey.private_key,
        ['https://www.googleapis.com/auth/calendar']
      );
      //authenticate request
      jwtClient.authorize(function (err, tokens) {
        if (err) {
          reject(err);
          PushSlack('Google authentication failed');
        } else {
          console.log("認証成功");
          resolve(jwtClient);
        }
      });
    });
  })
  .then(function(jwtClient){
    return new Promise(function(resolve,reject){
      const calendar = google.calendar('v3');
      // 今日の予定一覧取得
      calendar.events.list({
        calendarId: CalendarId,
        auth: jwtClient,
        timeMax: tomorrow.toJSON(),
        timeMin: today.toJSON(),
        singleEvents: true,
        orderBy: 'startTime',
      }, function (err, response) {
         if (err) {
           reject(err);
           PushSlack('Google API Data acquisition failure');
         }else{
           console.log('予定取得完了');
           UpdateNotification(response.data.items);
         }
      });  
    });
  })
  .then(function(result){
    callback(null, result);
  })
  .catch(function(err){
    callback(err);
  });
})();

/**
 * 予定通知の更新
 * @param {Object} items 今日の予定一覧
 */
function UpdateNotification(items) {
  //TODO 登録済みの今日の通知予定一覧を取得
  connection.connect(function(err) {
    if (err) {
      console.error('MySQL接続エラー: ' + err.stack);
      PushSlack('MySQL Connect failed');
      return;
    }
    console.log('MySQL接続: ' + connection.threadId);
    connection.query('SELECT * FROM notifications WHERE notification = 1 and DATE(start_t) = DATE(NOW())', 
    function(error, result, fields) {
      if (_.isEmpty(result)) {
        console.log('当日の初期データ投入');
        //TODO カレンダーの予定が1件もない場合の処理
        // Insert用のValue作成
        let values = [];
        async.each(items, function(value, callback) {
          values.push(GetInsertValue(value));
        });
        let sql = 'INSERT INTO notifications (id, calendar_id, summary, notification, start_t, end_t, create_t, update_t) ' + 
        'VALUES ' + values.join(", ");
         // Insertを実行し完了後にConnection破棄
        connection.query(sql, function(error, result, fields) {
          console.log(result);
          connection.destroy();
        });
      } else {
        console.log('予定一覧アップデート');
        let insertSql, updateSql;
        connection.beginTransaction(function(err) {
          if (err) { throw err; }
          async.each(items, function(value, callback) {
            let match = result.find(db_list => db_list.calendar_id === value.id);
            if (match) {
              if (GetFormatTime(match.update_t) != GetFormatTime(value.updated)) {
                console.log('更新データあり');
                updateSql = 'UPDATE notifications ' + GetUpdateValue(value, match.id);
                connection.query(updateSql, function(error, result, fields) {
                  if (error) {
                    return connection.rollback(function() { throw error; });
                  }
                });
              } else { console.log('更新データ無し'); }
            } else {
              //TODO 予定の新規追加
              insertSql = 'INSERT INTO notifications (id, calendar_id, summary, notification, start_t, end_t, create_t, update_t) ' + 
              'VALUES ' + GetInsertValue(value);
              connection.query(insertSql, function(error, result, fields) {
                console.log('新規データ追加');
                if (error) {
                  return connection.rollback(function() { throw error; });
                }
              });
            }
          });

          async.each(result, function(value, callback) {
            //TODO 予定の削除
            let unmatch = items.find(item_list => item_list.id === value.calendar_id);
            if (!unmatch) {
              updateSql = 'UPDATE notifications SET notification = 0 WHERE id = ' + value.id;
              connection.query(updateSql, function(error, result, fields) {
                console.log('データ削除');
                if (error) {
                  return connection.rollback(function() { throw error; });
                }
              });
            }
          });

          //TODO SQLを処理してMySQL Connectをkill
          sleep(sleepTime);
          connection.commit(function(err) {
            if (err) {
              return connection.rollback(function() { throw err; })
            }
            console.log('commit');
            connection.destroy();
          });
          
        });
      }
    });
  });
}

/**
 * datetimeフォーマット
 * @param {datetime} time
 */
function GetFormatTime(time) {
  return new Date(time).toFormat('YYYY-MM-DD HH24:MI:SS');
}

/**
 * error時の通知処理
 * @param {string} errPoint
 */
function PushSlack(errPoint) {
  let slack = new Slack();
  slack.setWebhook(webhookUri);
  slack.webhook({
    channel: "#nodejs",
    username: "webhookbot",
    text: "Point: " + errPoint
  }, function(err, response) {
    console.log(respose);
  });
}

/**
 * Insert用のSQL作成
 * @param {Object} value
 */
function GetInsertValue(value) {
  return '(null, ' + // id
  '"' + value.id + '", ' + // calendar_id
  '"' + value.summary + '", ' + // summary
  '1, ' + // notification
  '"' + GetFormatTime(value.start.dateTime) + '", ' + // start_t
  '"' + GetFormatTime(value.end.dateTime) + '", ' + // end_t
  '"' + GetFormatTime(value.created) + '", ' + // create_t
  '"' + GetFormatTime(value.updated) + '")'; // update_t
}

/**
 * Update用のSQL作成
 * @param {Object} value
 * @param {int} id
 */
function GetUpdateValue(value, id) {
  return 'SET ' + 
  'calendar_id = "' + value.id + '", ' +
  'summary = "' + value.summary + '", ' +
  'notification = 1, ' + 
  'start_t = "' + GetFormatTime(value.start.dateTime) + '", ' +
  'end_t = "' + GetFormatTime(value.end.dateTime) + '", ' + 
  'create_t = "' + GetFormatTime(value.created) + '", ' + 
  'update_t = "' + GetFormatTime(value.updated) + '" ' + 
  'WHERE id = ' + id;
}

/**
 * スリープ処理
 * @param {int} time 
 */
function sleep(time) {
  return new Promise((resolve, reject) => {
      setTimeout(() => { resolve(); }, time);
  });
}