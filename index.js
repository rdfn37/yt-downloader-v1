require('dotenv').config()

const accountSid = process.env.ACCOUNT_SID;
const authToken = process.env.AUTH_TOKEN;
const serviceSid = process.env.SERVICE_SID
const environmentSid = process.env.ENVIRONMENT_SID

const sandboxNumber = "whatsapp:+14155238886"
const client = require('twilio')(accountSid, authToken);

const { getInfo } = require('ytdl-core');
const ytdl = require('ytdl-core');

const FormData = require('form-data');
const axios = require('axios');

const express = require('express')
const app = express()
const port = process.env.PORT || 3000;

app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.post('/download', (req, res) => {
    if (req.body.url && req.body.number) {
        console.log(req.body.url)
        console.log("Account SID", accountSid)
        console.log("Auth Token", authToken)
        console.log("Service SID", serviceSid)

        // 1 - Download audio file from YouTube using ytdl.
        const getAudio = async (url) => {
            console.log("Downloading file...")

            const audio = ytdl(url, { filter: 'audioonly' })

            return audio
        }

        // 2 - Create asset
        const createAsset = async (title, url) => {
            console.log("Creating asset...");

            const assetSid = await client.serverless.v1.services(serviceSid)
                .assets
                .create({ friendlyName: title })
                .then(asset => asset.sid);

            const serviceUrl = `https://serverless-upload.twilio.com/v1/Services/${serviceSid}`;
            const uploadUrl = `${serviceUrl}/Assets/${assetSid}/Versions`;

            const form = new FormData();
            form.append('Path', `${title}.mp3`);
            form.append('Visibility', 'public');
            form.append('Content', await getAudio(url), {
                contentType: 'audio/mp3',
            });

            axios
                .post(uploadUrl, form, {
                    auth: {
                        username: accountSid,
                        password: authToken,
                    },
                    headers: form.getHeaders(),
                })
                .then((response) => {
                    const newVersionSid = response.data.sid;

                    updateBuild(newVersionSid, title)
                });
        }

        // 3 - Create new build
        const updateBuild = async (assetSid, title) => {
            console.log("Updating build...");

            const environment = await client.serverless.v1.services(serviceSid)
                .environments
                .list({ limit: 20 })
                .then(environments => environments[0]);

            const currentBuild = await client.serverless.v1.services(serviceSid)
                .builds(environment.buildSid)
                .fetch()
                .then(build => build);


            const updatedAssets = (build) => {
                let assets = []

                build.assetVersions.forEach(e => assets.push(e.sid))
                assets.push(assetSid)

                return assets
            }

            const newBuild = await client.serverless.v1.services(serviceSid)
                .builds
                .create({
                    functionVersions: [],
                    assetVersions: updatedAssets(currentBuild)
                })
                .then(build => fetchBuildStatus(build, title));
        }

        // 4 - Build Status
        const fetchBuildStatus = async (build, title) => {
            console.log("Checking build status...")

            let status = ""

            function checkBuildStatus(build) {
                client.serverless.v1.services(serviceSid)
                    .builds(build.sid)
                    .buildStatus()
                    .fetch()
                    .then(build_status => {
                        status = build_status.status

                        if (status === "completed") {
                            console.log("Building status: ", status)

                            stopInterval()
                            deploy(build, title)
                        }
                    });
            }

            const myInterval = setInterval(() => checkBuildStatus(build), 1000)
            function stopInterval() {
                clearInterval(myInterval)
            }
        }

        // 5 - Deploy
        const deploy = async (build, title) => {
            console.log("Deploying...")

            const createDeploy = await client.serverless.v1.services(serviceSid)
                .environments(environmentSid)
                .deployments
                .create({ buildSid: build.sid })
                .then(deployment => deployment);

            const sendMessage = await client.messages
                .create({
                    body: `https://mindless-thumb-5667.twil.io/${title}.mp3`,
                    from: sandboxNumber,
                    to: req.body.number
                })
                .then(message => console.log("Menssagem enviada"));

            console.log("Deploy completed: ", createDeploy);
            res.status(200).json({ message: "Success!", path: `https://mindless-thumb-5667.twil.io/${title}.mp3` })
        }

        // Run Function
        const downloader = async (url) => {
            const title = await getInfo(url)
                .then(data => data.videoDetails.title.replace(/\s+/g, '').replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/]/gi, '').trim());

            await createAsset(title, url)
        }

        downloader(req.body.url)

        // res.status(200).json({ message: "Success!" })
    } else {
        console.log("Error!")
        res.status(400).json({ message: "Error!" })
    }
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
