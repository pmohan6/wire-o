'use strict';

process.env['PATH'] = process.env['PATH'] + ':' + process.env['LAMBDA_TASK_ROOT'] + '/bin';
process.env['LD_LIBRARY_PATH'] = process.env['LAMBDA_TASK_ROOT'] + '/bin';

import downloadPdfs from './downloadPdfs';
import mergePdfs from './mergePdfs';
import uploadToS3 from './uploadToS3';
import storePDF from './storePdf';
import formatResponse from './formatResponse';

const storage = uploadToS3({ bucket: 'superglue' });
const uploadPDF = storePDF({ storage });

exports.handler = function(event, context) {
  console.time('Lambda runtime');

  downloadPdfs(event.pdfUrls)
    .then(mergePdfs)
    .then(uploadPDF)
    .then(formatResponse)
    .then(function (response) {
      context.succeed(response);
      console.log('Response:', response);
      console.timeEnd('Lambda runtime');
    })
    .catch(function (error) {
      console.log('Something went wrong:', error);
    });
}