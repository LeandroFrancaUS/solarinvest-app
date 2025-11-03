// pages/api/auth/logout.js
export default async function handler(req, res) {
  res.setHeader('Set-Cookie', 'solarinvest_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax');
  return res.status(200).json({ ok: true });
}