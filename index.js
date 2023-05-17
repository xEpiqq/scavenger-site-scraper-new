import puppeteerExtra, { PuppeteerExtra } from "puppeteer-extra"
import stealthPlugin from "puppeteer-extra-plugin-stealth"
import chromium from "@sparticuz/chromium"
import { doc, runTransaction } from 'firebase/firestore';
import { db } from "./firebase.js"
import AWS from 'aws-sdk';
AWS.config.update({ accessKeyId: "AKIA3BC7ARLGHVDKAI74", secretAccessKey: "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", })
const s3 = new AWS.S3()


async function scrape(list_id, url_i, url_id, obj_id) {
    
    const docRef = doc(db, `sheets/${list_id}`)
    puppeteerExtra.use(stealthPlugin())

    // const browser = await puppeteerExtra.launch({
    //     headless: false,
    //     executablePath: "/usr/bin/google-chrome",
    //     defaultViewport: chromium.defaultViewport,
    //     ignoreHTTPSErrors: true,
    // })

    const browser = await puppeteerExtra.launch({
        args: chromium.args,
        defaultViewport: chromium.defaultViewport,
        executablePath: await chromium.executablePath(),
        ignoreHTTPSErrors: true,
        headless: chromium.headless,
    })

    const page = await browser.newPage()
    await page.goto(url_id)
    await page.waitForTimeout(2000)

    const current_url = await page.url();
    const secured = current_url.includes('https');
    const html = await page.content();
    const hrefs = await page.$$eval('a', as => as.map(a => a.href))

    const fileStream = await page.screenshot({ encoding: 'binary' })
    const fileStream2 = await page.screenshot({ encoding: 'binary' })


    let facebook = "", twitter = "", instagram = "", youtube = "", linkedin = "", contact_us = "";

    for (let i = 0; i < hrefs.length; i++) {
        if (hrefs[i].includes('facebook')) {
            facebook = hrefs[i]
        }
        if (hrefs[i].includes('twitter')) {
            twitter = hrefs[i]
        }
        if (hrefs[i].includes('instagram')) {
            instagram = hrefs[i]
        }
        if (hrefs[i].includes('youtube')) {
            youtube = hrefs[i]
        }
        if (hrefs[i].includes('linkedin')) {
            linkedin = hrefs[i]
        }
        if (hrefs[i].includes('contact')) {
            contact_us = hrefs[i]
        }
        if (hrefs[i].includes('Contact')) {
            contact_us = hrefs[i]
        }
        if (hrefs[i].includes('CONTACT')) {
            contact_us = hrefs[i]
        }
    }

    const emails = await findEmails(html, contact_us, page)

    const pages = await browser.pages()
    await Promise.all(pages.map((page) => page.close()))
    await browser.close()

    const template = await checkTemplate(html)

    const stripped_url_id = url_i.replace(/\./g, '')
    await uploadToStorageBucket(stripped_url_id, "desktop", fileStream)
    await uploadToStorageBucket(stripped_url_id, "mobile", fileStream2)

    await runTransaction(db, async (transaction) => {
        const userSnapshot = await transaction.get(docRef);
        const listsArray = userSnapshot.data().lists;
        const targetIndex = listsArray.findIndex(list => list.obj === obj_id);
        
        if (targetIndex !== -1) {
                if (emails) {
                    listsArray[targetIndex].emails = emails;
                }
                listsArray[targetIndex].facebook = facebook;
                listsArray[targetIndex].twitter = twitter;
                listsArray[targetIndex].instagram = instagram;
                listsArray[targetIndex].youtube = youtube;
                listsArray[targetIndex].linkedin = linkedin;
                listsArray[targetIndex].contact_us = contact_us;
                listsArray[targetIndex].secured = secured;
                listsArray[targetIndex].template = template;
                listsArray[targetIndex].desktop_screenshot = `https://scavenger-screenshots.s3.us-west-2.amazonaws.com/desktop_${stripped_url_id}.png`
                listsArray[targetIndex].mobile_screenshot = `https://scavenger-screenshots.s3.us-west-2.amazonaws.com/thumbnail_${stripped_url_id}.png`
                listsArray[targetIndex].thumbnail_screenshot = `https://scavenger-screenshots.s3.us-west-2.amazonaws.com/mobile_${stripped_url_id}.png`                
            }

        transaction.update(docRef, { lists: listsArray }) })

    return
}

async function uploadToStorageBucket(stripped_url_id, scrn_type, fileStream) {
    const uploadParamsDesktop = {
        Bucket: "scavenger-screenshots", Key: `${scrn_type}_${stripped_url_id}.png`,
        Body: fileStream, ContentType: 'image/png', ACL: 'public-read'
    }
    s3.upload(uploadParamsDesktop, err => err ? console.error("Upload failed") : null);
}

async function findEmails(html, contact_us, page) {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
    let emails = html.match(emailRegex); // find through home-page html

    if (contact_us !== "") { 
        await page.goto(contact_us)
        await page.waitForTimeout(2000)
        const html = await page.content();
        emails = html.match(emailRegex);
    }
    emails = [...new Set(emails)]
    emails = emails.filter(email => !email.includes('.jpg') && !email.includes('.png') && !email.includes('.gif'))
    
    return emails
}

async function checkTemplate(html) {
    const template_sites = ["wix", "weebly", "godaddy", "wordpress", "shopify", "squarespace", "jimdo", "webnode", "site123", "big cartel", "voog", "yola", "webflow", "zyro", "ucraft", "clickfunnels", "websitebuilder", "zoho", "carrd", "sitebuilder", "site2you", "siteground", "siteorigin", "sitey", "simplesite"];
    const html_lower = html.toLowerCase()
    let templated = {}
    for (let i = 0; i < template_sites.length; i++) {
        const template = template_sites[i]
        const regex = new RegExp(template, 'g')
        const count = (html_lower.match(regex) || []).length
        if (count > 0) {
            templated[template] = count
        }
    }
    let template = 'custom'
    if (Object.keys(templated).length === 0) {
        template = 'custom'
    }
    if (Object.keys(templated).length === 1) {
        template = Object.keys(templated)[0]
    }
    if (Object.keys(templated).length > 1) {
        const template_array = Object.keys(templated)
        const template_count_array = Object.values(templated)
        const max = Math.max(...template_count_array)
        const index = template_count_array.indexOf(max)
        template = template_array[index]
    }
    if (Object.keys(templated).includes('clickfunnels')) {
        template = 'clickfunnels'
    }
    return template
}


export const handler = async (event) => {
    const body = JSON.parse(event.body)
    const { list_id, url_i, obj_id } = body
    const url_id = "http://" + url_i
    await scrape(list_id, url_i, url_id, obj_id)
    
    return {
        statusCode: 200,
        body: JSON.stringify({ message: "secondary scrape complete"})
    }
}

// handler({
//     body: JSON.stringify({
//         list_id: "KrSsP2Far8Z63WNp477t",
//         url_i: "mcdonalds.com",
//         obj_id: "4c78324c-313d-4c2b-9a65-67506561b01d"
//     }),
// })