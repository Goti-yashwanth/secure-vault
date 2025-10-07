// pages/api/auth.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getDb } from '../../src/lib/mongo';
import { DBUser } from '../../src/lib/types';
import bcrypt from 'bcryptjs';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { action, email, password } = req.body as {
    action: 'signup' | 'login';
    email: string;
    password: string;
  };

  if (!email || !password) return res.status(400).json({ success: false, message: 'Missing fields' });

  const db = await getDb();
  const isMongo = !!db.collection; // check if MongoDB connection

  if (isMongo) {
    const usersCollection = db.collection<DBUser>('users');
    const user = await usersCollection.findOne({ email });

    if (action === 'signup') {
      if (user) return res.status(409).json({ success: false, message: 'User exists' });
      const hashed = await bcrypt.hash(password, 10);
      const newUser: DBUser = { _id: 'u_' + Math.random().toString(36).slice(2, 9), email, hashedMasterPassword: hashed };
      await usersCollection.insertOne(newUser);
      return res.json({ success: true, userId: newUser._id });
    } else {
      if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      const match = await bcrypt.compare(password, user.hashedMasterPassword);
      if (!match) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      return res.json({ success: true, userId: user._id });
    }
  } else {
    // In-memory fallback
    const globalAny: any = db;
    const users = globalAny.users as DBUser[];
    const user = users.find(u => u.email === email);

    if (action === 'signup') {
      if (user) return res.status(409).json({ success: false, message: 'User exists' });
      const newUser: DBUser = { _id: 'u_' + Math.random().toString(36).slice(2, 9), email, hashedMasterPassword: password };
      users.push(newUser);
      return res.json({ success: true, userId: newUser._id });
    } else {
      if (!user || user.hashedMasterPassword !== password) return res.status(401).json({ success: false, message: 'Invalid credentials' });
      return res.json({ success: true, userId: user._id });
    }
  }
}
