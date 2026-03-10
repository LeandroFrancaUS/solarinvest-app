declare module 'vite/client' {}

// Vite ?url suffix — returns the resolved public URL of any asset as a string
declare module '*?url' {
  const src: string
  export default src
}
