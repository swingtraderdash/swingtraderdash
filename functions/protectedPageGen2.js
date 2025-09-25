import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { readFile } from 'fs/promises';
import path from 'path';

initializeApp();

export const protectedPageGen2 = onRequest({ region: 'us-central1' }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', 'https://swingtraderdash-1a958.web.app');
  res.set('Access-Control-Allow-Methods', 'GET');
  res.set('Access-Control-Allow-Headers', 'Authorization');

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.redirect(302, '/index.html');
  }

  const idToken = authHeader.split('Bearer ')[1];

  try {
    await getAuth().verifyIdToken(idToken);
    const filePath = path.join(__dirname, 'protected', req.path.replace(/^\//, ''));
    const fileContent = await readFile(filePath, 'utf8');
    res.status(200).set('Content-Type', 'text/html').send(fileContent);
  } catch (error) {
    res.redirect(302, '/index.html');
  }
});
