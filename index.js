'use strict';
// module 読み込み
const {google} = require('googleapis');
const async = require('async');
const mysql = require('mysql');
require('date-utils');
require('dotenv').config();

// Object生成
const CalendarId = process.env.CALENDAR_ID;
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
             ['https://www.googleapis.com/auth/calendar']);
      //authenticate request
      jwtClient.authorize(function (err, tokens) {
        if (err) {
          reject(err);
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
         }else{
           // console.log(response.data.items);
           UpdateNotification(response.data.items);
           
           /*
           resolve(response.data.items);
           let reservation = null;
           reservation = GetFirstReservation(response.data.items);
           if (reservation != null) {
             console.log('予約取得成功');
             console.log(reservation);
             const setTime = new Date(reservation.end.dateTime).getTime() - 300;
             SetAlarm(setTime);
           } else {
             //TODO その日の予約が1件もない場合の処理（必要？）
           }
           */
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
      console.error('error connecting: ' + err.stack);
      return;
    }
    console.log('connected as id ' + connection.threadId);
    async.each(items, function (value, callback) {
      console.log('time: ' + value.created);
      console.log('format: ' + GetFormatTime(value.created));
      connection.destroy();
      /*
      let sql = 'INSERT INTO notifications ' + 
      '(calendar_id, summary, notification, start_t, end_t, create_t, update_t) ' + 
      'VALUES ("' + value.id + '", "' + value.summary + '", 0, "' + value.start.dateTime + '", "' + value.end.dateTime + '", "' + value.created + '", "' + value.updated + '")';
      console.log(sql);
      */
    });
  });
}
  /*
  connection.query('SELECT * FROM notifications', 
   function(error, result, fields) {
      console.log('error: ' + error);
      console.log(result);
      console.log('fields: ' + fields);
      connection.destroy();
  });
  */
  //TODO 更新が必要な予定があるか判定
  //TODO 更新が必要な場合はDBを更新

/**
 * datetimeフォーマット
 * @param {datetime} time
 */
function GetFormatTime(time) {
  return new Date(time);
}

/**
 * 直近の予定を1件取得
 * @param {Object} items 今日の予定一覧
 */
/*
function GetFirstReservation(items) {
  let reservation = null;
  const now = new Date().getTime();
  async.each(items, function (value, callback) {
    console.log(value.summary);
    const start = new Date(value.start.dateTime).getTime();
    const end = new Date(value.end.dateTime).getTime();
    if (start < now && end > now) {
      reservation = value;
      //console.log('現在の予定');
    } else if (reservation == null && start > now) {
      reservation = value;
      //console.log('次の予定');
    }
    //TODO 予定が重なっている場合の考慮
  });
  //TODO 予定が取得できたらループを抜ける
  return reservation;
}
*/

/**
 * 指定時間にアラームセット
 * @param {int} alarm
 */
/*
function SetAlarm(alarm) {
  // https://developer.amazon.com/ja/docs/alexa-voice-service/enable-named-timers-and-reminders.html
  // この辺をURLを参考に
  console.log("time: " + alarm);
}
*/