const functions = require('firebase-functions');
const admin = require('firebase-admin');
const logger = require("firebase-functions/logger");

admin.initializeApp();

// No functions needed for basic client-side login
// Delete sessionLogin and pageGatekeeper to simplify
