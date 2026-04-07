export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'default-secret-key',
  expiresIn: '24h',
};
