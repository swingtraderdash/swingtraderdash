import { onRequest } from 'firebase-functions/v2/https';

export const testGen2 = onRequest({ region: 'us-central1' }, (req, res) => {
  res.status(200).send('Gen 2 is alive.');
});
