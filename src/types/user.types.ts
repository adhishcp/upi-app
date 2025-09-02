export interface User {
  id: number;
  email: string;
  password: string;
  name?: string | null;
  role: 'USER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

export type UserWithoutPassword = Omit<User, 'password'>;
