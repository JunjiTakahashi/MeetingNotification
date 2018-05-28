'use strict';
// module 読み込み
const mysql = require('mysql');
require('date-utils');
require('dotenv').config();
const async = require('async');
const _ = require('underscore');
let mdns = require('mdns');
let browser = mdns.createBrowser(mdns.tcp('googlecast'));

// Object生成
const connection = mysql.createConnection({
  host     : process.env.DB_HOST,
  user     : process.env.DB_USER,
  password : process.env.DB_PASS,
  database : process.env.DB_NAME
});
const sleepTime = 1000;

(function() {
    GetDeviceList().then(result => {
        async.each(result, function(device, callback) {
            connection.query('SELECT * FROM accounts WHERE name = "' + device.txtRecord.fn + '"', function(error1, result1, fields1) {
                if (error1) {
                    return connection.rollback(function() { throw error1; })
                }
                if (!_.isEmpty(result1)) {
                    let updateSql = 'UPDATE accounts ' + 
                    'SET device_id = "' + device.name + '", ip = "' + device.addresses[0] + '" ' + 
                    'WHERE id = ' + result1[0].id;
                    connection.query(updateSql, function(error2, result2, fields2) {
                        if (error2) {
                            return connection.rollback(function() { throw error2; })
                        }
                    });
                }
            });
        });
        sleep(sleepTime);
        connection.destroy();
    });
})();

/**
 * キャストできるデバイスリストの取得
 */
async function GetDeviceList() {
    browser.start();
    let devices = [];
    browser.on('serviceUp', function(service) {
        console.log('Name: "%s" DeviceID: "%s" IP: "%s"', service.txtRecord.fn, service.name, service.addresses[0]);
        devices.push(service);
        browser.stop();
    });
    await sleep(sleepTime);
    return devices;
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