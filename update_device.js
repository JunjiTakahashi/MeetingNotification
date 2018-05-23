'use strict';
// module 読み込み
const mysql = require('mysql');
require('date-utils');
require('dotenv').config();
let mdns = require('mdns');
let browser = mdns.createBrowser(mdns.tcp('googlecast'));

// Object生成
const connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : process.env.DB_NAME
});

(function() {
    browser.start();
    browser.on('serviceUp', function(service) {
      //console.log('Device "%s" at %s:%d', service.name, service.addresses[0], service.port);
      console.log('Name: "%s" DeviceID: "%s" IP: "%s"', service.txtRecord.fn, service.name, service.addresses[0]);
      connection.query('SELECT * FROM accounts WHERE name = ' + service.txtRecord.fn, function(error, result, fields) {
          if (result.device_id != service.name) {
              console.log('更新が必要');
          }
      });
      browser.stop();
    });
    /*
    connection.connect(function(err) {
        if (err) {
         console.error('MySQL接続エラー: ' + err.stack);
          PushSlack('MySQL Connect failed');
          return;
        }
        console.log('MySQL接続: ' + connection.threadId);

        connection.query('SELECT * FROM accounts',
        function(error, result, fields) {
            console.log(result);
            //TODO 同一Wi-Fi内でキャストできるGoogleHomeを検索
            //TODO キャストGoogleHomeと同じDeviceIDの端末をDBから検索
            //TODO IPアドレスを更新
            connection.destroy();
        });
    });
    */
})();