//SETUP

//a library to look for variables in a .env file in the root directory
require('dotenv').config();


//twilio library, comes with functions to send/receive messages
var twilio = require('twilio');

//selenium library (select components), allows autonnavigation of websites and basic scraping
const {Builder, By, Key, until} = require('selenium-webdriver');

//input by user; keywords to identify events; one string / one number per event, either indices or keywords
//e.g. node program.js Nicole Tchami
//e.g. node program.js 1 3
var eventIdentifiers = process.argv.slice(2);

//stores one driver per event
var drivers = [];

//stores URLs of each event
var eventLinks = [];

//instance of a formatter; has functions to format #s
var formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
         });

//create utilityDriver
var utilityDriver = new Builder()
        .forBrowser('chrome')
        .build();


//ALL FUNCTIONS ARE BY DEFINITION CHAINED ONE AFTER ANOTHER

function signInGetPartial () {
    //create one driver per event, sign in each
    for (var i in eventIdentifiers) {
        var driver = new Builder()
            .forBrowser('chrome')
            .build();
        drivers.push(driver)
        driver.get('https://production.billfoldpos.com')
        .then( () =>
            driver.findElement(By.id('user_login')).sendKeys('kylel', Key.RETURN))
        .then( () =>
            driver.findElement(By.id('user_password')).sendKeys(process.env.kyle_pass, Key.RETURN))
    }

    //create the initial webdriver and sign in
    utilityDriver.get('https://production.billfoldpos.com')
    .then( () =>
        utilityDriver.findElement(By.id('user_login')).sendKeys('kylel', Key.RETURN))
    .then( () =>
        utilityDriver.findElement(By.id('user_password')).sendKeys('pillory,dele,quasar,juncture', Key.RETURN))
    .then( () =>
        getEventLinks(eventIdentifiers))
}


//for each event search term, get the URL
function getEventLinks(eventIdentifiers) {
    //if user input indices
    if (parseFloat(eventIdentifiers[0])) {
        for (var i in eventIdentifiers) {
            utilityDriver.executeScript(`return [jQuery('tr').eq(${parseFloat(i) +1}).find('td a').attr('href'), jQuery('tr').eq(${parseFloat(i) +1}).find('td a').eq(0).text()]`)
            .then( (partialLink_Title) => {
                eventLinks.push(('https://production.billfoldpos.com' + partialLink_Title[0]));
                console.log('MONITORING REV FOR: ' + partialLink_Title[1] )
            })
            .then(() => {
                if (eventLinks.length === eventIdentifiers.length) {
                    getAmounts(eventLinks)
                }
            })
        }
    } else {
        //if user input search Terms
        for (var i in eventIdentifiers) {
            utilityDriver.executeScript(`return [jQuery('tr td div:contains(${eventIdentifiers[i]})').closest('tr').find('td a').attr('href'), jQuery('tr td div:contains(${eventIdentifiers[i]})').closest('tr').find('td a').eq(0).text()]`)
            .then( (partialLink_Title) => {
                eventLinks.push(('https://production.billfoldpos.com' + partialLink_Title[0]));
                console.log('MONITORING REV FOR: ' + partialLink_Title[1] )
            })
            .then(() => {
                if (eventLinks.length === eventIdentifiers.length) {
                    getAmounts(eventLinks)
                }
            })
        }
    }
}


//for each event URL, get the relevant amounts, and create a payload with event Title, Cash, and Card amounts
function getAmounts(eventLinks) {
    for (i in eventLinks) {
        var payload = {title: null, cash:null, card:null};
        var driver = drivers[i]

        driver.get(eventLinks[i] + '/event_reports/new_report1?utf8=%E2%9C%93&min_created_at=&max_created_at=&payment_method%5B%5D=Cash&vendor_profile_id%5B%5D=f5d06b39-5760-4d7b-b620-0687f4571a4d&vendor_profile_id%5B%5D=fa430a0b-4200-4021-af8d-841dd94423b2&commit=Filter')
        .then(() =>
        driver.findElement(By.css('.header.item')).getAttribute('text'))
        .then((title) =>
        payload.title = title)
        .then( () =>
        driver.findElement(By.css('input[name="commit"]')).click())
        .then(() =>
        driver.executeScript("return jQuery('.right.aligned')[jQuery('.right.aligned').length - 10].innerText"))
        .then((cash) =>
        payload.cash = cash)
        .then(() =>
        driver.get(eventLinks[i] + '/event_reports/report1?utf8=✓&min_created_at=&max_created_at=&payment_method%5B%5D=payment_card&vendor_profile_id%5B%5D=f5d06b39-5760-4d7b-b620-0687f4571a4d&vendor_profile_id%5B%5D=fa430a0b-4200-4021-af8d-841dd94423b2&commit=Filte &commit=Filter'))
        .then(() =>
        driver.executeScript("return jQuery('.right.aligned')[jQuery('.right.aligned').length - 10].innerText"))
        .then((card) =>
         payload.card = card)
        .then(() =>
        prepareToSend(payload))
    }
}

//helper function
function stringToMoney(stringAmount) {
    if (stringAmount) {
        return parseFloat(stringAmount.replace('$', '').replace(',', ''));
    } else {
        return 0;
    }
}

//take in payload of {title, cash and card}; format numbers, add numbers
function prepareToSend(payload) {
    if (payload.cash.indexOf('$') > -1 || payload.card.indexOf('$') > -1) {
        var amount = formatter.format(stringToMoney(payload.cash) + stringToMoney(payload.card))
    } else {
        amount = '$0'
    }
    sendText(payload.title, amount)
}


//take in payload of title, and total amount, and send messages
function sendText(title, amount) {
    const accountSid = 'AC9c46a4978740a40185a14205955dd157';
    const authToken = '1e4acdae9016943a672365597a1bd1d4';
    const client = require('twilio')(accountSid, authToken);
    const header = `The current revenue for ${title} is ${amount}`

    //Note - to send to multiple recipients, can only copy/paste blocks below; can't use loops b/c of twilio constraints

    //whatsapp
    client.messages
      .create({
        from: 'whatsapp:+14155238886',
        to: 'whatsapp:+18588294808',
        body: header
      })
      .then(message => console.log(message.sid))
      .done();


    //sms
    client.messages
        .create({
            from: '+16199164143',
            to: '+18588294808',
            body: header
        })
        .then(message => console.log(message.sid))
        .done();
}

//EXECUTION
var initialWait;
var now = new Date()

if (now.getMinutes() > 30) {
    initialWait = (60 - now.getMinutes())*60*1000;
} else {
    initialWait = (30 - now.getMinutes())*60*1000;
}

signInGetPartial();

initialWait = 2000;

setTimeout(function() {
    setInterval(function() {
        getAmounts(eventLinks)
    }, 180000)
}, initialWait)


