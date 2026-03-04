export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  app: {
    head: {
      title: 'CV Adapt // VVM',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'dark' }
      ],
      script: [
        { src: '/index.js', defer: true }
      ]
    }
  },
  css: ['~/assets/styles.css'],
  nitro: {
    prerender: {
      routes: ['/', '/pipeline']
    }
  }
});
