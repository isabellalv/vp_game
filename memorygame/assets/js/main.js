//------------------------------------------------------------------------------------------------------------------
/* GLOBAL */
const MTURK_SUBMIT = "https://www.mturk.com/mturk/externalSubmit";
const SANDBOX_SUBMIT = "https://workersandbox.mturk.com/mturk/externalSubmit";
const DEBUG = true; // DEBUG mode only runs config.debugMode.numTrials of a sequence
const DEV = isSandbox(); // if sandbox is in the URL, we are in developer (DEV) mode

let config = {}; // general experiment configurations
let instructions = {}; // instructions and other customizable text
let runInfo = {}; // specific settings for this run
let numTrials;

let state = {
    trialIndex: -1, // nextTrial updates it at the top
    responses: [], // tracking trial indices for which worker made a response
    medium: getMedium(), // platform the user has been referred from (e.g., mTurk),
    // keyIsDown: false, // tracking if response key is currently pressed down
    initTime: "",
    finishTime: ""
};

let images1 = new Array();
let images2 = new Array();
let fixation = new Image(); //should this be commented out? not sure if this is how you cycle through new images 

// SessionStorage
/** Built-in javascript object. SessionStorage properties allow to save key/value pairs in a web browser.
The sessionStorage object stores data for only one session (the data is deleted when the browser tab is closed).
 Using it here for parameters we need to preserve across runs within a sessions**/
if (!sessionStorage.assignmentId || sessionStorage.assignmentId != gup("assignmentId")) {
    // if there is no assignmentId yet or it has changed, it means worker is running a new HIT (or switched from
    // preview to real), means reset
    console.log("resetting sessionStorage properties");
    resetSessionStorage();
}

//preview should be adjusted to task? Do adjustments need to be made? 
// also need to incorporate rapid categorization task eventually prior to main experiment 
let preview = isPreview(sessionStorage.assignmentId)
console.log("preview", preview);


//------------------------------------------------------------------------------------------------------------------
/*GET AND CHECK SOME INFO*/
function gup(name) {
    const regexS = "[\\?&]" + name + "=([^&#]*)";
    const regex = new RegExp(regexS);
    const tmpURL = window.location.href;
    const results = regex.exec(tmpURL);
    if (results == null) return "external";
    else return results[1];
}

function getMedium(){
    /** To make the distinction between test runs in the Sandbox, participants participating through mTurk and
     *  participants participating through other media (e.g., received link via email). Note that when workers
     *  on mTurk are only doing the preview and not the real experiment yet, there is no way of telling the
     *  difference between the regular mturk and the sandbox. They will be treated as "mturk" (but no submissions
     *  will be allowed anyway)
     */
    const tmpURL = window.location.href;

    let medium;
    if (tmpURL.indexOf('turk') > -1 || tmpURL.indexOf('ASSIGNMENT_ID_NOT_AVAILABLE') > -1) {
        if (tmpURL.indexOf("sandbox") > -1) {
            medium = "mturk_sandbox";
        } else {
            medium = "mturk";
        }
    } else {
        medium = "external";
    }
    return (medium)
}

function isSandbox() {
    const tmpURL = window.location.href;
    return tmpURL.includes("sandbox")
}

function getWorkerId(){
    const medium = getMedium();
    if (medium === "mturk" || medium === "mturk_sandbox"){
        return(gup("workerId"))
    }else{
        const workerId = $("#idcode-text").val();
        return workerId.replace(/['"]+/g, '')
    }
}

function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
}

function isTouchDevice() {
    return 'ontouchstart' in document.documentElement;
}

function isPreview(assignmentId){
    // mTurk will use "ASSIGNMENT_ID_NOT_AVAILABLE" as the assignmentId when it's a preview
    if (assignmentId== "ASSIGNMENT_ID_NOT_AVAILABLE") {
        return true;
    }
    else {
        return false;
    }
}

//I think this goodtoGo function can be left as is? 
function goodToGo(){
    if (runInfo.blocked || runInfo.finished) {
        showSorry(instructions.sorry.noMoreHits_first, instructions.sorry.noMoreHits_later);
        return false
    } else if (runInfo.maintenance){
        showSorry(instructions.sorry.maintenance_first, instructions.sorry.maintenance_later);
        return false
    } else if (runInfo.running) {
        showSorry(instructions.sorry.running_first, instructions.sorry.running_later);
        return false
    } else {
        return true
    }
}


//------------------------------------------------------------------------------------------------------------------
/* HELPER FUNCTIONS */
function resetSessionStorage(){
    sessionStorage.runInSession = JSON.stringify(0);
    sessionStorage.assignmentId = gup("assignmentId"); //assigns necessary mturk info 
    sessionStorage.bonusEarned = JSON.stringify(0); //records payload information, can be left as is 
    sessionStorage.sessionData = JSON.stringify([]); //records payload information 
    sessionStorage.medium = getMedium();
}

//To ask: not sure what is small chunk does 
function showPage(id, includeDisclaimer = false){
    $('#main').children().each(function(){
        let innerDiv = $(this);
        innerDiv.css("display", "none");
    });

    $('#'.concat(id)).css("display", "flex")
    if (includeDisclaimer){
        $('#disclaimer-box').css("display", "flex")
    }else{
        $('#disclaimer-box').css("display", "none")
    }
}
//Error messages 
function showSorry(text_first, text_later){
    $("#sorry_image").attr('src', config.game_settings.sorry);

    if (JSON.parse(sessionStorage.runInSession)!==0){
        // Make sure they can still submit previous runs within current session
        console.log("rescue operation")
        $("#rescue-button").removeClass("disabled");
        $("#rescue-button").css("display","flex");
        $("#sorry_text").html(text_later);
    }
    else{
        // Nothing to submit when it's the first run of a session
        $("#sorry_text").html(text_first);
    }
    showPage("sorry", includeDisclaimer = true)
}

//tests and preloads image before experiment page: 
function testImage(url) {
    /**from emil.c's answer to https://stackoverflow.com/questions/9815762/
     * detect-when-an-image-fails-to-load-in-javascript
     */

    console.log(url)
    // Define the promise
    const imgPromise = new Promise(function imgPromise(resolve, reject) {

        // Create the image
        const imgElement = new Image();

        // When image is loaded, resolve the promise
        imgElement.addEventListener('load', function imgOnLoad() {
            resolve(this);
        });

        // When there's an error during load, reject the promise
        imgElement.addEventListener('error', function imgOnError() {
            reject();
        })

        // Assign URL
        imgElement.src = url;

    });

    return imgPromise;
}
    //clarify what this hidden field does and where it goes 
function addHiddenField(form, name, value) {
    // form is a jQuery object, name and value are strings
    const input = $("<input type='hidden' name='" + name + "' value=''>");
    input.val(value);
    form.append(input);
}
//*commented out: this function is used to indicate feedback during the memory game
// function blinkBorder(color, elementId, ms) {
//     const border = document.getElementById(elementId);
//     let normalColor = border.style.outlineColor;
//     border.style.outlineColor = color;
//     border.style.outlineWidth = "2px";
//     console.log("changing border");
//     setTimeout(function () {
//         border.style.outlineColor = normalColor;
//         border.style.outlineWidth = "1px";
//     }, 150);
// }


//------------------------------------------------------------------------------------------------------------------
/* INTERACTIVE PARTS */
function enableOnEntry() {
    let text = this.value;
    if (text !== ''){
        console.log("found participation code");
        $("#instruction-button").removeClass("disabled");
    }else{
        $("#instruction-button").addClass("disabled");
    }
}

// Next Trial Button 
function enableNextButton() {
    $("#nexttrial-button").removeClass("disabled");
    }

function getResponse(_callback) {
    var radios = document.getElementsByName("rating");
    var selected = Array.from(radios).find(radio => radio.checked);
    if (typeof selected !== 'undefined') {}
    state.responses.push(selected.value); // add to list of trials where a response was made
    console.log(state.responses);
    //Clear rating scale
    selected.checked = false;
    //Disable next trial button until next trial click
    $("#nexttrial-button").addClass("disabled");
    _callback();
    }

function setupButtons() {
    // Button to set up the game
    if ($("#idcode-field").length){
            $("#instruction-button").addClass("disabled");
            let textarea = document.getElementById("idcode-text");
            textarea.addEventListener('input', enableOnEntry);
    }


    $("#instruction-button").click(setupExperiment);

    // Button to start the actual game after images have been loaded
    $("#start-button").click(function () {
        // Commented out: Start listening for key presses rather than buttons (until the end)
        // document.addEventListener("keydown", processKeyDown);
        // document.addEventListener("keyup", processKeyUp);

        // Show experiment page (and everything else will be invisible)
        showPage("experiment");

        //No dummy image, start experiment
        nextTrial();
    });

    // Rescue button (to allow workers to still submit if they end up on the sorryPage because of an error)
    $("#rescue-button").addClass("disabled");
    $("#rescue-button").click(function(){showPage("submitPage");});


    $("#nexttrial-button").click(function(){getResponse(nextTrial)});
    $("#nexttrial-button").addClass("disabled");
    var radios = document.getElementsByName("rating");
    for (var ii = 0; ii < radios.length; ii++){
        radios[ii].onclick =enableNextButton;
        radios[ii].checked=false;
    }

    //Commented out: Don't need keep playing or stop playing button
    // // Allow workers to complete extra runs more for bonus
    // $("#keep-playing-button").click(restart);

    // // When worker does not want to complete more runs
    $("#stop-playing-button").click(function(){showPage("submitPage");});

    // Submit button
    $("#submit-button").click(submitRuns);

}
// **Commented out: key press functionality is not needed - replaced with simRating response data being recorded  
// function processKeyDown(e) {
//     if (e.keyCode === config.game_settings.responseKeyCode) {
//         console.log('response key down')
//         if (!state.keyIsDown) {
//             if (state.trialIndex != -1) { // -1 is the start trial (dummy), not a real trial

//                 state.responseIndex.push(state.trialIndex) // add to list of trials where a response was made

//                 if (config.game_settings.trialFeedback) {
//                     // Check if trial condition is considered a go trial
//                     if (config.game_settings.goTrials.includes(runInfo.conditions[state.trialIndex])) {
//                         blinkBorder("#33cc33", "mem_image", 150);
//                     } else {
//                         blinkBorder("red", "mem_image", 150)
//                     }
//                 } else {
//                     // Blink blue to show response was detected
//                     blinkBorder("blue", "mem_image", 150);
//                 }
//             }
//         }
//         state.keyIsDown = true;
//     } else {
//         return;
//     }
// }

// function processKeyUp(e) {
//     if (e.keyCode === config.game_settings.responseKeyCode) {
//         console.log('response key up')
//         state.keyIsDown = false;
//     } else {
//         return;
//     }
// }


//------------------------------------------------------------------------------------------------------------------
/* CONTENT */
function populateTextFields() {

    // Header
    $("#normal-title").html(config.header.title);
    $("#requester-details").html(config.header.requester)
    if (preview) {
        $("#preview-appendix").html(" - PREVIEW");
    } else {
        $("#preview-appendix").html("");
    }

    // Instruction page
    $("#description").html(instructions.instructions.description);

    $("#guidelines-simple").html(instructions.instructions.guidelines_simple);
    for (let i = 0; i < instructions.instructions.guidelines_steps.length; i++) {
        let node = document.createElement("LI");
        node.innerHTML = instructions.instructions.guidelines_steps[i];
        node.style.marginBottom = "5px";
        $("#guidelines-steps").append(node);
    }
   // $("#guidelines-final-notes").html(instructions.instructions.guidelines_final_notes);

    $("#prerequisites-simple").html(instructions.instructions.prerequisites_simple);
    for (let i = 0; i < instructions.instructions.prerequisites_steps.length; i++) {
        let node = document.createElement("LI");
        node.innerHTML = instructions.instructions.prerequisites_steps[i];
        node.style.marginBottom = "5px";
        $("#prerequisites-steps").append(node);
    }

    $("#idcode-instructions").html(instructions.instructions.id_code);

    // Game page
    $("#instructions-oneliner").html(instructions.instructions.oneliner);

    // End of game page
    for (let i = 0; i < instructions.endText.steps.length; i++) {
        let node = document.createElement("LI");
        node.innerHTML = instructions.endText.steps[i];
        node.style.marginBottom = "5px";
        $("#end-instructions").append(node);
    }

    // Disclaimer
    $("#disclaimer").html(instructions.disclaimer);
}

function preload(){
    let progressBarLength = numTrials+1;
    let counter = 0;

    for (let i = 0; i < numTrials; i++) {
        (function (i){
            testImage(config.images.baseUrl.concat(runInfo.images1[i]).replace(/ /g,"%20")).then(function(image1){
                images1[i] = image1;
                testImage(config.images.baseUrl.concat(runInfo.images2[i]).replace(/ /g,"%20")).then(function(image2){
                    counter += 1;
                    images2[i] = image2
                    $("#progress-bar").css('width', String(100 * (counter) / progressBarLength) + "%");
                    $("#progress_text").html(String(Math.round(100 * (counter) /progressBarLength)) + "%");
                    if (counter == progressBarLength){
                        $("#start-button").removeClass("disabled");
                    }
                }).catch(function(error2){
                    console.log("problem loading second image for trial ", i);
                    showSorry(instructions.sorry.error_first, instructions.sorry.error_later);
                })
            }).catch(function(error1){
                console.log("problem loading images for trial ",i);
                showSorry(instructions.sorry.error_first, instructions.sorry.error_later);
            })
        }).call(this, i);
    }

    // fixation image - should be removed from my experiment 
    testImage(config.game_settings.fixation).then(function(image){
        counter += 1;
        fixation = image;
        $("#progress-bar").css('width', String(100 * (counter) / progressBarLength) + "%");
        $("#progress_text").html(String(Math.round(100 * (counter) /progressBarLength) + "%"));
        if (counter == progressBarLength){
                $("#start-button").removeClass("disabled");
        }
    }).catch(function(error){
        console.log("problem loading fixation");
        showSorry(instructions.sorry.error_first, instructions.sorry.error_later);
    })
}


//------------------------------------------------------------------------------------------------------------------
/* EXPERIMENT FLOW */
function setupExperiment() {

    // No longer ask for id code
    if ($("#idcode-field").length){
        $("#instruction-button").removeClass("disabled");
        $('#idcode-text').prop('disabled', true);
    }

    // Get workerId
    sessionStorage.workerId = getWorkerId()

    // Don't let experiment start when worker is on phone or tablet
    if (isMobileDevice()) {
        showSorry(instructions.sorry.phone, instructions.sorry.phone)

    } else {
        // Check if we are in mTurk's preview mode, no submit button becasue there is no work being done 
        if (preview) {
            $("#submit-button").remove();
        }
        // Initialize Run: this is what starts the trial (along with back end communication)
        initializeRun();
    }
}

function initializeRun() {
    // Here we'll ask the server to send back all the information we need to initialize a new series based
    // on the worker's unique ID
    let initializeUrl;

    if (preview){
        initializeUrl = config.serverUrl + "initializepreview";
    }else{
        initializeUrl = config.serverUrl + "initializerun";
    }
    const workerData = {
        "workerId": sessionStorage.workerId,
        "medium": sessionStorage.medium,
        "trialFeedback": config.game_settings.trialFeedback
        //^^this trialFeedback lets a participant know if their response is correct, would probbaly only need this in the case of the rapid categor. part of experiment
    };
    console.log(initializeUrl)
    $.ajax({
        url:  initializeUrl,
        type: 'GET',
        data: workerData
        // this ajax part is talking to the backend 

    }).then(function (response) {
        console.log("workerData received from Server:", response);
        runInfo = response;
        if (!DEBUG) {
            numTrials = runInfo.images1.length;
        }else{
            numTrials = config.debugMode.numTrials; // only show a few trials when debugging
        }
        if (goodToGo()){
            // Record date and time
            const today = new Date();
            const date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
            const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
            const dateTime = date + ' ' + time;
            state.initTime = dateTime;

            // Preload images (because now it knows what images to load from backend)
            $("#start-button").addClass("disabled"); // disable until images are loaded
            showPage("loadingImages");
            preload();

        }
        //this is the error below if the ajax function did not work 
   }).catch(function (error) {
        // This means there was an error connecting to the DEVELOPER'S
        // server and the game did not initialize correctly
        showSorry(instructions.sorry.error_first, instructions.sorry.error_later);
        console.log("ERROR", error)
    })
}

function nextTrial() {
    // Update trialIndex

    state.trialIndex++;
    console.log(state.trialIndex);

    // End game if last trial
    if (state.trialIndex == numTrials) {
        showPage("submitPage");
        finishRun();

    // Show next image --> this would be need to changed so that it waits until a participant makes a response rather than doing it by time 
    } else {
        $("#img_1").attr("src", images1[state.trialIndex].src);
        $("#img_2").attr("src", images2[state.trialIndex].src);
        //setTimeout(function () {
        //     $("#mem_image").attr("src", config.game_settings.fixation);
        //     setTimeout(function () {
        //         nextTrial();
        //     }, config.game_settings.fixationDuration);
        // }, config.game_settings.imageDuration);
    }
}

function finishRun() {
    // Get finish time
    let today = new Date();
    let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
    let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    let dateTime = date+' '+time;
    state.finishTime = dateTime;

    // Gather payload to be sent to backend
    let payload = {
        assignmentId: sessionStorage.assignmentId,
        workerId: sessionStorage.workerId,
        indexToRun: runInfo.index_to_run,
        sequenceFile: runInfo.sequenceFile,
        responses: state.responses,
        preview: preview,
        timestamp: runInfo.timestamp, // from the backend
        medium: sessionStorage.medium,
        initTime: state.initTime,
        finishTime: state.finishTime,
        numTrials: numTrials
    }

    if (preview){
        $("#earnings").html("This is a preview!");
        $("#keep-playing").css("display","none");
        $("#stop-playing").css("display","flex");
        $("#end-text").html("This is a preview. If you wish to participate for real, please accept the HIT first.");
        $("#end-text").css("color", "red");
        $("#keep-playing-button").addClass("disabled")
        $("#stop-playing-button").addClass("disabled")

    }else{
        // Keep playing button - fix to reflect blocks but money is calculated as reward based on fixed reward level 
        $("#keep-playing-button").addClass("loading");
        $("#keep-playing-button").addClass("disabled");

        // Update earnings
        let bonusEarned = config.game_settings.reward.amount * JSON.parse(sessionStorage.runInSession)
        sessionStorage.bonusEarned = JSON.stringify(bonusEarned);
        $("#earnings").html(String(bonusEarned+config.game_settings.reward.amount)+" "+config.game_settings.reward.currency);

        // Update sessionData
        // We're holding on to the data of all runs within a session, such that it could be sent along with the submit
        // (e.g., to mTurk server) if desired
        let sessionData = JSON.parse(sessionStorage.sessionData);
        sessionData.push(payload);
        sessionStorage.sessionData = JSON.stringify(sessionData);
    }

    // Send data
    const FINALIZE_URL = config.serverUrl + "finalizerun";

    $.ajax({
        url: FINALIZE_URL,
        type: 'POST',
        data: JSON.stringify(payload),
        dataType: 'json',
        contentType: "application/json"
    }).then(function (response) {
        console.log(response);

        //*Commented out: feedback to participant is not needed nor recorded
        // Feedback - this should be changed to reflected similarity response number rather than accuracy and response time 
        // if (response["hit_rate"] >= 0){
        //     let hits = Math.round(response["hit_rate"]*100).toString() + "%";
        //     $("#repeats-detected").html(hits);
        // }else{
        //     // Negative score is backend telling us there were no repeats
        //     $("#repeats-detected").html("no repeats were shown");
        // }
        // let falseAlarms = response["false_alarm_num"].toString();
        // $("#wrong-presses").html(falseAlarms);

        // // Can continue playing?
        // if (!preview){
        //     if (response["blocked"] || response["finished"] ){
        //         $("#keep-playing-button").removeClass("loading");
        //         $("#maintenance-message").html("");
        //     }
        //     else if(response["maintenance"]) {
        //         $("#keep-playing-button").removeClass("loading");
        //         $("#maintenance-message").html(instructions.endText.maintenanceText);
        //     }else{
        //         $("#keep-playing-button").removeClass("loading");
        //         $("#keep-playing-button").removeClass("disabled");
        //     }
        // }

    }).catch(function (error) {
        // This means there was an error connecting to the backend
        // even if there is a bug/connection problem at this point,
        // we want people to be paid.
        console.log("ERROR", error);

        // Show ERROR because scores are unavailable
        //("#repeats-detected").html("ERROR");
        ("#wrong-presses").html("ERROR");

        // Display error message
        if (!preview){
            //$("#keep-playing").css("display","none");
            $("#stop-playing").css("display","flex");
            $("#error-text").html(instructions.sorry.error_finish);
            $("#error-text").css("color", "red");
        }
    })
}

//to clarify: does this start a new session in there was error - this does not start a new block, right? 
function restart() {
    // New run, update runInSession
    sessionStorage.runInSession = JSON.stringify(JSON.parse(sessionStorage.runInSession) + 1)

    // Reset state values
    state.trialIndex = 0;
    state.responses = [];

    // Back to instructions page
    showPage("instructions");
}
//to clarify: does this update trials --> or what is a run vs. a trial (is a run per participant?)
function submitRuns(){
    $("#submit-button").addClass("loading");
    if (state.medium == "mturk"){
        mturkSubmit(MTURK_SUBMIT);
    }else if (state.medium == "mturk_sandbox"){
        mturkSubmit(SANDBOX_SUBMIT);
    }else{
        otherSubmit(config.serverUrl + "submitruns");
    }
}

function mturkSubmit(submitUrl) {
    // Data to send to mturk
    const mturkPayload = {
        assigmentId: sessionStorage.assignmentId,
        workerId: sessionStorage.workerId,
        earnedBonus: config.game_settings.reward.amount * JSON.parse(sessionStorage.runInSession)
        //data: sessionStorage.sessionData // uncomment if you want to save the data on the mTurk side as well
    };

    // mTurk requires a form - is this the output form? Change to record relevant variables 
    let form = $("#submit-form");
    addHiddenField(form, 'assignmentId',  sessionStorage.assignmentId);
    addHiddenField(form, 'workerId', sessionStorage.workerId);
    addHiddenField(form, 'feedback', $("#feedback-input").val());
    addHiddenField(form, 'data', JSON.stringify(mturkPayload));
    $("#submit-form").attr("action", submitUrl);
    $("#submit-form").attr("method", "POST");

    console.log(mturkPayload)
    console.log(submitUrl)
    var output_info = document.getElementById("submit-form");
    var data = output_info.querySelectorAll("input:not([type=submit]), select");
    console.log(data)

    // Submit form
    $("#submit-form").submit();
    $("#submit-button").removeClass("loading");

}

function otherSubmit(submitUrl){
    console.log("text")
    const sessionDataParsed = JSON.parse(sessionStorage.sessionData);
    const otherPayload = {
        workerId: sessionStorage.workerId,
        timestamp: sessionDataParsed[sessionDataParsed.length - 1].timestamp,
        compensation: config.game_settings.reward.amount * (JSON.parse(sessionStorage.runInSession) + 1),
        medium: state.medium,
        feedback: $("#feedback-input").val()
    };

    // Submit
    $.ajax({
        url: submitUrl,
        type: 'POST',
        data: JSON.stringify(otherPayload),
        dataType: 'json',
        contentType: "application/json"
    }).then(function (response) {
        console.log(response)
        $("#submit-button").removeClass("loading");
        $("#submit-button").addClass("disabled");
        submitEval("positive");
        resetSessionStorage();
    }).catch(function (error) {
       console.log(error);
       submitEval("negative");
    })
}

function submitEval(evaluation){
    $("#submit-eval").css("display", "");
    if (evaluation == "positive"){
        $("#submit-eval").html(instructions.submitEval.positive);
        $("#submit-eval").css("background-color", "green");
        $("#submit-eval").css("color", "white");

    }else{
        $("#submit-eval").html(instructions.submitEval.negative);
        $("#submit-eval").css("background-color", "red");
        $("#submit-eval").css("color", "white");
    }
}


//------------------------------------------------------------------------------------------------------------------
/* MAIN */
// this is the main part of the code, the rest of it is just helper functions, loading info from the right json files 
$(document).ready(function () {
    console.log("DEV", DEV);
    console.log('hello');
    let config_file = "config.json";
    let instructions_file;
    if (sessionStorage.medium == "mturk" || sessionStorage.medium == "mturk_sandbox") {
        instructions_file = "instructions_mturk.json"
        $("#idcode-field").remove()
    } else {
        instructions_file = "instructions.json"
        console.log(instructions_file);
    }
    $.getJSON(config_file).done(function (x) {
        config = x;
        $.getJSON(instructions_file).done(function (y) {
            instructions = y;
            populateTextFields();
            setupButtons();
        });
    });
});