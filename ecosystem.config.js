module.exports = {
    apps: [
        {
            name: 'cv-builder',
            script: 'server.js',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production',
                PORT: process.env.PORT || 3000,
                GEMINI_API_KEY: process.env.GEMINI_API_KEY,
                TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN: process.env.TELEGRAM_VVM_CV_ADAPTOR_BOT_TOKEN
            }
        }
    ]
};

