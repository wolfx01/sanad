import pool from '@/lib/db';
import bcrypt from 'bcryptjs';

export interface User {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  created_at: Date;
}

export type SafeUser = Omit<User, 'password_hash'>;

export async function findUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query(
    'SELECT id, name, email, password_hash, role, created_at FROM users WHERE LOWER(email) = LOWER($1)',
    [email.trim()]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function findUserById(id: number): Promise<SafeUser | null> {
  const result = await pool.query(
    'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
    [id]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

export async function registerUser(
  name: string,
  email: string,
  password: string,
  role: string = 'user'
): Promise<SafeUser> {
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    throw new Error('البريد الإلكتروني مسجل بالفعل');
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, email, role, created_at`,
    [name.trim(), email.trim().toLowerCase(), passwordHash, role]
  );

  return result.rows[0];
}

export async function authenticateUser(
  email: string,
  password: string
): Promise<SafeUser> {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
  }

  const { password_hash, ...safeUser } = user;
  return safeUser;
}
