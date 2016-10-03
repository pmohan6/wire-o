'use strict';

var exec = require('child_process').exec;

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'] + '/bin';
process.env['LD_LIBRARY_PATH'] = process.env['LAMBDA_TASK_ROOT'] + '/bin';

var PDFMerge = require('pdf-merge');
var request = require('request');
var async = require('async');
var fs = require('fs');
var AWS = require('aws-sdk');
var s3 = new AWS.S3();
var uuid = require('node-uuid');


exports.handler = function(event, context) {
  console.time('lambda runtime');

  var PdfSaver = function(urls, cb) {
    console.time('save pdfs to tmp directory');
    async.each(urls, function(pdfUrl, callback) {
      var requestSettings = {
        method: 'GET',
        url: pdfUrl,
        encoding: null
      };

      request(requestSettings, function(err, response, buffer) {
        var base64Pdf = new Buffer(buffer).toString('base64');
        if (!err) {
          writeToTmp(base64Pdf);
          console.log('File encoded.');
          callback();
        } else {
          callback('Error encoding file.');
        }
      });
    }, function(err) {
      if (err) {
        console.log('File did not process');
      } else {
        console.log('All files processed');
        console.timeEnd('save pdfs to tmp directory');
        cb();
      }
    });
  }

  function writeToTmp(base64) {
    var filePath = '/tmp/' + uuid.v4() + '.pdf'

    fs.writeFile(filePath, new Buffer(base64, "base64"), function (err) {
      if (err) {
        console.log('Did not write file to tmp.');
      } else {
        console.log('Wrote file to tmp directory.');
      }
    });
  }

  function findTmpFiles() {
    fs.readdir('/tmp/', function (err, files) {
      if (err) {
        console.log('Error reading file from bin directory');
      } else {
        mergeFiles(files);
      }
    });
  }

  function deleteTmpFiles(files) {
    files.forEach(function(file) {
      fs.unlink(file);
    });
  }

  function mergeFiles(files) {
    for (var i in files) {
      files[i] = '/tmp/' + files[i];
    }

    var pdftkPath = './bin/pdftk';
    var pdfMerge = new PDFMerge(files, pdftkPath);
    pdfMerge
      .asBuffer()
      .merge(function(error, buffer) {
        if (error) {
          console.log('Error merging');
        }
        var key = 'merged/' + uuid.v4() + '.pdf';
        var params = { Bucket: 'superglue', Key: key, Body: buffer};

        s3.putObject(params, function (err, s3Data) {
          if (err) {
            console.log('Error sending to S3: ' + err);
          }
          deleteTmpFiles(files);
          var link = 'https://s3.amazonaws.com/superglue/' + key;

          console.timeEnd('lambda runtime');
          context.succeed(link);
        });
    });
  }

  PdfSaver(event.pdfUrls, findTmpFiles);
}