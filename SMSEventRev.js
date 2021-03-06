//SETUP
const dotenv = require('dotenv');

dotenv.config();

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

function signInGetEvents () {
    //create the initial webdriver and sign in; used to get eventLinks
    utilityDriver.get('https://production.billfoldpos.com')
    .then( () =>
        utilityDriver.findElement(By.id('user_login')).sendKeys(process.env.KYLE_LOGIN, Key.RETURN))
    .then( () =>
        utilityDriver.findElement(By.id('user_password')).sendKeys(process.env.KYLE_PASS, Key.RETURN))
    .then( () =>
        getEventLinks(eventIdentifiers))
}


//for each event search term, get the URL
function getEventLinks(inputtedEventIdentifiers) {
    if (inputtedEventIdentifiers.length > 0) {
        //if user input indices
        if (parseFloat(inputtedEventIdentifiers[0])) {
            var index = parseFloat(inputtedEventIdentifiers.splice(-1));
            utilityDriver.executeScript(`return [jQuery('tr').eq(${index}).find('td a').attr('href'), jQuery('tr').eq(${index}).find('td a').eq(0).text()]`)
            .then( (partialLink_Title) => {
                eventLinks.push(('https://production.billfoldpos.com' + partialLink_Title[0]));
                console.log('MONITORING REV FOR: ' + partialLink_Title[1] )
            })
            .then(() =>
                getEventLinks(inputtedEventIdentifiers))
        } else {
        //if user input search Terms
            var term = inputtedEventIdentifiers.splice(-1);
            utilityDriver.executeScript(`return [jQuery('tr td div:contains(${term})').closest('tr').find('td a').attr('href'), jQuery('tr td div:contains(${term})').closest('tr').find('td a').eq(0).text()]`)
            .then( (partialLink_Title) => {
                eventLinks.push(('https://production.billfoldpos.com' + partialLink_Title[0]));
                console.log('MONITORING REV FOR: ' + partialLink_Title[1] )
            })
            .then(() =>
                getEventLinks(inputtedEventIdentifiers))
        }
    } else {
        console.log('Sending results now, then on every half hour mark');
        getAmounts(eventLinks);
    }
}


//for each event URL, get the relevant amounts, and create a payload with event Title, Cash, and Card amounts
//vendors to include: mixology & main
//amounts to grab: Gross Cash and Net Sales COW(Bank Card)
function getAmounts(inputtedEventLinks) {
    var payload = {title: null, cash:null, card:null};
    if (inputtedEventLinks.length > 0) {
        setTimeout(function() {
            var currentEvent = inputtedEventLinks.splice(-1);
            utilityDriver.get(currentEvent + '/event_reports/report1?utf8=✓&min_created_at=&max_created_at=&payment_method%5B%5D=Payment%3A%3AType%3A%3ACash&vendor_profile_id%5B%5D=27613e30-3845-4d65-bc2a-0490f2ec0c13&vendor_profile_id%5B%5D=65c57359-ffae-4ee7-9a8a-1850f6074a03&commit=Filter')
            .then(() =>
            utilityDriver.findElement(By.css('.header.item')).getAttribute('text'))
            .then((title) =>
            payload.title = title)
            .then( () =>
            utilityDriver.findElement(By.css('input[name="commit"]')).click())
            .then(() =>
            utilityDriver.executeScript("return jQuery('.right.aligned')[jQuery('.right.aligned').length - 11].innerText"))
            .then((cash) =>
            payload.cash = cash)
            .then(() =>
            utilityDriver.get(currentEvent + '/event_reports/report1?utf8=✓&min_created_at=&max_created_at=&payment_method%5B%5D=payment_card&vendor_profile_id%5B%5D=27613e30-3845-4d65-bc2a-0490f2ec0c13&vendor_profile_id%5B%5D=65c57359-ffae-4ee7-9a8a-1850f6074a03&commit=Filter'))
            .then(() =>
            utilityDriver.executeScript("return jQuery('.right.aligned')[jQuery('.right.aligned').length - 10].innerText"))
            .then((card) =>
             payload.card = card)
            .then(() => prepareToSend(payload))
            .then( () =>
            getAmounts(inputtedEventLinks)
            )
        }, 10000);
    }
}

//helper function to take amount from webpage to actual number
function stringToNum(stringAmount) {
    return parseFloat(stringAmount.replace('$', '').replace(',', '')) || 0;
}

//take in payload of {title, cash and card}; format numbers, add numbers
function prepareToSend(payload) {
    if (payload.cash.indexOf('$') > -1 || payload.card.indexOf('$') > -1) {
        var amount = formatter.format(stringToNum(payload.cash) + stringToNum(payload.card))
    } else {
        amount = '$0'
    }
    sendText(payload.title, amount)
}


//take in payload of title, and total amount, and send messages
function sendText(title, amount) {
    const accountSid = process.env.Twilio_Sid;
    const authToken = process.env.Twilio_AToken;
    const header = `The current revenue for ${title} is ${amount}`
    const client = require('twilio')(accountSid, authToken);

    //Note - to send to multiple recipients, can only copy/paste blocks below; can't use loops b/c of twilio constraints

    //whatsapp
    client.messages
      .create({
        from: 'whatsapp:+14155238886',
        // to: 'whatsapp:+18588294808',
        to: 'whatsapp:+12063842889',
        body: header
      })
      // .then(message => console.log(message.sid))
      .done();


    //sms
    client.messages
        .create({
            from: '+16199164143',
            to: '+18588294808',
            body: header
        })
        // .then(message => console.log(message.sid))
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


signInGetEvents();

// initialWait = 2000;


setTimeout(function() {
    getAmounts(eventLinks);
    setInterval(function() {
        getAmounts(eventLinks)
    }, 1800000)
}, initialWait)



