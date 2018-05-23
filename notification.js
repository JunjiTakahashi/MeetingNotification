'use strict';
// module 読み込み
const mysql = require('mysql');
const async = require('async');
require('date-utils');
require('dotenv').config();
const _ = require('underscore');
const googlehome = require('google-home-notifier');
const language = 'ja';

// Object生成
const connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : process.env.DB_NAME
});

(function() {
    
    connection.connect(function(err) {
        if (err) {
         console.error('MySQL接続エラー: ' + err.stack);
          PushSlack('MySQL Connect failed');
          return;
        }
        console.log('MySQL接続: ' + connection.threadId);
        let joinObj = {
            table1: 'accounts', key1: 'id',
            table2: 'notifications', key2: 'accounts_id',
            //conditions: 'notification = 1 and end_t = "' + GetAfter5min() + '"'
            conditions: 'notification = 1' // テスト用
        };
        let notificationSql = GetNotificationValue(joinObj);
        console.log(notificationSql);
        connection.query(notificationSql, function(error, result, fields) {
            if (!_.isEmpty(result)) {
                async.each(result, function(value, callback) {
                    console.log(value);
                    /*
                    googlehome.device(value.device_id, language);
                    googlehome.notify('ここに喋らせるテキスト', function(res) {
                        console.log(res);
                    });
                    */
                });
                connection.destroy();
            }
        });
    });
})();

/**
 * 5分後の時間を取得
 */
function GetAfter5min() {
    let after5min = new Date().add({minutes: 5});
    return after5min.toFormat('YYYY-MM-DD HH24:MI:00');
}

/**
 * RelationalDataの取得
 * @param {Object} join
 */
function GetNotificationValue(join) {
    return 'SELECT * FROM ' + join.table1 + ' JOIN ' + join.table2 + 
    ' ON ' + join.table1 + '.' + join.key1 + ' = ' + join.table2 + '.' + join.key2 +
    ' WHERE ' + join.conditions;
}