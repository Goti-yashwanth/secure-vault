// pages/api/vault.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import clientPromise from '@/lib/mongo';
import { encryptText, decryptText } from '@/lib/crypto';
import { VaultItem, DecryptedItem } from '@/lib/types';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const client = await clientPromise;
    const db = client.db('secureVault'); // Your database name
    const collection = db.collection('vaultItems');

    if (req.method === 'POST') {
      const { name, content, userId } = req.body;

      if (!name || !content || !userId) {
        return res.status(400).json({ message: 'Missing required fields' });
      }

      // Encrypt content before storing
      const encryptedContent = await encryptText(content, userId);

      const vaultItem: VaultItem = {
        name,
        content: encryptedContent,
        userId,
        createdAt: new Date(),
      };

      await collection.insertOne(vaultItem);
      return res.status(200).json({ message: 'Item stored successfully' });
    }

    if (req.method === 'GET') {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ message: 'Missing userId' });
      }

      const items = await collection.find({ userId }).toArray();

      const decryptedItems: DecryptedItem[] = await Promise.all(
        items.map(async (item) => ({
          _id: item._id.toString(),
          name: item.name,
          content: await decryptText(item.content, userId as string),
          createdAt: item.createdAt,
        }))
      );

      return res.status(200).json(decryptedItems);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        return res.status(400).json({ message: 'Missing id' });
      }

      await collection.deleteOne({ _id: new ObjectId(id as string) });
      return res.status(200).json({ message: 'Item deleted successfully' });
    }

    res.setHeader('Allow', ['POST', 'GET', 'DELETE']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    console.error('Vault API Error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
}
