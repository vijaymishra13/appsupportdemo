
var builder = require('botbuilder');
var restify = require('restify');

var server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log('%s listening to %s', server.name, server.url);
});

var connector = new builder.ChatConnector({
    appId: 'a3616594-f309-4ca0-8af1-94880a7114cb',
    appPassword: 'VGKr5wnsUjG4GF7MwkjRAFk'
});

var bot = new builder.UniversalBot(connector);
server.post('/api/messages', connector.listen());


// LUIS Service for AppSupportDemo LUIS APP
var model = 'https://api.projectoxford.ai/luis/v2.0/apps/f445ce5f-1520-4d0e-aca0-c49f7012a38f?subscription-key=e86a03e6ed394f1098da68f85f380f8e&verbose=true';
var recognizer = new builder.LuisRecognizer(model);
var dialog = new builder.IntentDialog({ recognizers: [recognizer] });
bot.dialog('/', dialog);

dialog.onBegin(function (session, args, next) {
    console.log(args);
    session.dialogData.name = args.name;
    session.send("Hi %s...", args.name);
    next();
});

// Add intent handlers
dialog.matches('getOrderStatus', [
    function (session, args, next) {
        // Resolve and store any entities passed from LUIS.
        var orderNumber = builder.EntityRecognizer.findEntity(args.entities, 'orderNumber');

        var orderContext = session.dialogData.orderContext = {
            orderNumber: orderNumber ? orderNumber.entity : null
        };

        console.log("Order Number: " + orderContext.orderNumber);
        // Prompt for title
        if (orderContext.orderNumber == null) {
            builder.Prompts.text(session, 'What is the order you are looking for?');
        } else {
            next({response : orderNumber.entity});
        }
    },
    function (session, results, next) {
        var orderContext = session.dialogData.orderContext;
        console.log("Results respone: " + results.response);
        if (results.response) {
            orderContext.orderNumber = results.response;
        }

        // Prompt for time (title will be blank if the user said cancel)
        if (orderContext.orderNumber != null) {
            session.send('Okay. Let me get information on Order Number ' + orderContext.orderNumber);
        } else {
            session.send('Ok... no problem.');
        }
    }
]);

dialog.matches('builtin.intent.alarm.delete_alarm', [
    function (session, args, next) {
        // Resolve entities passed from LUIS.
        var title;
        var entity = builder.EntityRecognizer.findEntity(args.entities, 'builtin.alarm.title');
        if (entity) {
            // Verify its in our set of alarms.
            title = builder.EntityRecognizer.findBestMatch(alarms, entity.entity);
        }

        // Prompt for alarm name
        if (!title) {
            builder.Prompts.choice(session, 'Which alarm would you like to delete?', alarms);
        } else {
            next({ response: title });
        }
    },
    function (session, results) {
        // If response is null the user canceled the task
        if (results.response) {
            delete alarms[results.response.entity];
            session.send("Deleted the '%s' alarm.", results.response.entity);
        } else {
            session.send('Ok... no problem.');
        }
    }
]);

dialog.onDefault(builder.DialogAction.send("I'm sorry I didn't understand."));

function defaultAction(args) {
    console.log("Printing the arguments:" + args);
    builder.DialogAction.send("I'm sorry I didn't understand.")
};

// Very simple alarm scheduler
var alarms = {};
setInterval(function () {
    var now = new Date().getTime();
    for (var key in alarms) {
        var alarm = alarms[key];
        if (now >= alarm.timestamp) {
            var msg = new builder.Message()
                .address(alarm.address)
                .text("Here's your '%s' alarm.", alarm.title);
            bot.send(msg);
            delete alarms[key];
        }
    }
}, 15000);