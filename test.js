require('dotenv').config()

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;

const axios = require("axios").default;

const postUrl = "https://yt-downloader-v1.herokuapp.com/download"


const config = {
    auth: {
        username: accountSid,
        password: authToken,
    }
}

const body = {
    url: "https://www.youtube.com/watch?v=Vavhup7vK-c",
    number: 'whatsapp:+5522997810740'
}

axios.post(postUrl, body, config)
    .then
