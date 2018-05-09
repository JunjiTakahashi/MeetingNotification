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

(function() {
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
           // console.log(response.data.items);
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
        console.log('dataなし');
        // Insert用のValue作成
        let values = [];
        async.each(items, function(value, callback) {
          values.push('(null, ' + // id
          '"' + value.id + '", ' + // calendar_id
          '"' + value.summary + '", ' + // summary
          '1, ' + // notification
          '"' + GetFormatTime(value.start.dateTime) + '", ' + // start_t
          '"' + GetFormatTime(value.end.dateTime) + '", ' + // end_t
          '"' + GetFormatTime(value.created) + '", ' + // create_t
          '"' + GetFormatTime(value.updated) + '")'); // update_t
        });
        let joinValue = values.join(", ");
        let sql = 'INSERT INTO notifications (id, calendar_id, summary, notification, start_t, end_t, create_t, update_t) ' + 
        'VALUES ' + joinValue;
         // Insertを実行し完了後にConnection破棄
        connection.query(sql, function(error, result, fields) {
          console.log(result);
          connection.destroy();
        });
      } else {
        console.log('dataあり');
        console.log(items);
        connection.destroy();
        /*
        async.each(items, function(value, callback) {
          let sql = 'INSERT INTO notifications (id, calendar_id, summary, notification, start_t, end_t, create_t, update_t) ' + 
          'VALUES (' + 
          'null, ' + // id
          '"' + value.id + '", ' + // calendar_id
          '"' + value.summary + '", ' + // summary
          '0, ' + // notification
          '"' + GetFormatTime(value.start.dateTime) + '", ' + // start_t
          '"' + GetFormatTime(value.end.dateTime) + '", ' + // end_t
          '"' + GetFormatTime(value.created) + '", ' + // create_t
          '"' + GetFormatTime(value.updated) + '")'; // update_t

          console.log(sql);
          connection.query(sql, function(error, result, fields) {
            console.log(error);
            console.log(result);
            console.log(fields);
          });
        });
        */
      }
      /*
      console.log(result['3']);
      console.log('start: ' + result['3'].start_t);
      console.log('end: ' + result['3'].end_t);
      console.log('create: ' + result['3'].create_t);
      console.log('update: ' + GetFormatTime(result['3'].update_t));
      */
      //console.log(fields);
      //connection.destroy();
    });
    /*
    async.each(items, function (value, callback) {
      console.log('time: ' + value.start.dateTime);
      console.log('format: ' + GetFormatTime(value.start.dateTime));
      
      
      let sql = 'INSERT INTO notifications ' + 
      '(id, calendar_id, summary, notification, start_t, end_t, create_t, update_t) ' + 
      'VALUES (null, "' + value.id + '", "' + value.summary + '", 0, "' + GetFormatTime(value.start.dateTime) + '", "' + GetFormatTime(value.end.dateTime) + '", "' + GetFormatTime(value.created) + '", "' + GetFormatTime(value.updated) + '")';
      console.log(sql);
      
      connection.query(sql, function(error, result, fields) {
        console.log(error);
        console.log(result);
        console.log(fields);
        connection.destroy();
      });
    });
    */
  });
}
  //TODO 更新が必要な予定があるか判定
  //TODO 更新が必要な場合はDBを更新

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