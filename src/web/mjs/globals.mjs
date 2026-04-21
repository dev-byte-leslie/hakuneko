/**
 * HAKU-0010: Register vendored library globals.
 * Connectors and engine modules access these as bare globals (e.g. CryptoJS.AES.decrypt).
 * This file replaces the nine <script> tags in index.html that loaded vendored copies.
 */
import CryptoJS from 'crypto-js';
import JSZip from 'jszip';
import protobuf from 'protobufjs';
// pdfkit/js/pdfkit.standalone.js is the browser-compatible build (no Node stream/buffer polyfills needed)
import PDFDocument from 'pdfkit/js/pdfkit.standalone.js';
import Hls from 'hls.js';
import OAuth from 'oauth-1.0a';
import ASS from 'assjs';
import initSqlJs from 'sql.js';
import EXIF from 'exif-js';

window.CryptoJS = CryptoJS;
window.JSZip = JSZip;
window.protobuf = protobuf;
window.PDFDocument = PDFDocument;
window.Hls = Hls;
window.OAuth = OAuth;
window.ASS = ASS;
window.EXIF = EXIF;

// sql.js requires async WASM initialization. BookmarkImporter is only invoked
// on user action (well after page load), so async assignment is safe.
initSqlJs().then(SQL => {
    window.SQL = SQL;
});
