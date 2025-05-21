// Get the correct elements by their IDs
const inputField = document.getElementById('userInput');
const outputField = document.getElementById('output');
const submitButton = document.getElementById('submitBtn');
let currentDefinitionIndex = 0;
let definitions = [];
let awaitingNext = false;
let retryMode = false;
let incorrectQueue = [];
let questionHistory = [];

// Fetch definitions from the JSON file
fetch('./assets/definitions.json')
    .then(response => response.json())
    .then(data => {
        definitions = data;
        displayDefinition();
    })
    .catch(error => {
        outputField.textContent = 'Error loading definitions.';
        console.error('Error:', error);
    });

// Mark a question as incorrect
function markIncorrect(index) {
    if (!incorrectQueue.some(q => q.index === index)) {
        incorrectQueue.push({ index, correctStreak: 0, lastAsked: questionHistory.length });
    }
}

// Mark a question as correct
function markCorrect(index) {
    const q = incorrectQueue.find(q => q.index === index);
    if (q) {
        q.correctStreak++;
        if (q.correctStreak >= 4) {
            incorrectQueue = incorrectQueue.filter(q2 => q2.index !== index);
        } else {
            q.lastAsked = questionHistory.length;
        }
    }
}

// Get the next question index, considering incorrect questions
function getNextQuestionIndex() {
    // If it's time to repeat an incorrect question
    if (
        incorrectQueue.length > 0 &&
        questionHistory.length >= 4 &&
        (questionHistory.length - incorrectQueue[0].lastAsked >= 4)
    ) {
        return incorrectQueue[0].index;
    }
    // Otherwise, pick a new question not in incorrectQueue
    let available = definitions
        .map((_, i) => i)
        .filter(i => !incorrectQueue.some(q => q.index === i));
    if (available.length === 0) available = definitions.map((_, i) => i);
    // Pick next sequentially
    let nextIndex = available.find(i => !questionHistory.includes(i));
    if (nextIndex === undefined) nextIndex = available[0];
    return nextIndex;
}

// Display the current definition
function displayDefinition() {
    currentDefinitionIndex = getNextQuestionIndex();
    questionHistory.push(currentDefinitionIndex);
    // Render the prompt with HTML formatting
    outputField.innerHTML = `<div class="terminal-feedback">
        <span style="color:#50fa7b">user@admin</span>
        <span style="color:#fff">:</span>
        <span style="color:#8be9fd">Definition</span>
        <span style="color:#fff">$</span> <span id="typed-definition"></span><span class="blinking-cursor">&#9608;</span>
        <span style="color:#f1fa8c; float:right; font-size: 0.9em;">Q${questionHistory.length}</span>
    </div>`;
    const feedbackElement = document.getElementById("typed-definition");
    // Type out only the definition text
    typeText(feedbackElement, definitions[currentDefinitionIndex].definition, 30);
    inputField.value = '';
    inputField.disabled = false;           // Enable typing for new question
    inputField.style.display = '';         // Make sure input is visible
    submitButton.style.display = 'inline-block';
    removeNextButton();
    inputField.focus();
    awaitingNext = false;
}

// Show feedback message
function showFeedback(message, color) {
    outputField.innerHTML = message;
}

// Remove the Next Question button if it exists
function removeNextButton() {
    const nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.remove();
}

// Show the Next Question button
function showNextButton() {
    removeNextButton();
    const nextBtn = document.createElement('button');
    nextBtn.id = 'nextBtn';
    nextBtn.className = 'btn';
    nextBtn.textContent = 'Next Question';
    nextBtn.onclick = () => {
        currentDefinitionIndex++;
        displayDefinition();
    };
    // Create a centered container
    const centerDiv = document.createElement('div');
    centerDiv.className = 'centered';
    centerDiv.appendChild(nextBtn);

    outputField.appendChild(document.createElement('br'));
    outputField.appendChild(centerDiv);
}

// Show incorrect feedback animation
function showIncorrectFeedback() {
    const terminal = document.querySelector('.terminal');
    terminal.classList.add('incorrect');
    setTimeout(() => {
        terminal.classList.remove('incorrect');
    }, 400); // Match the animation duration
}

// Show correct feedback animation
function showCorrectFeedback() {
    const terminal = document.querySelector('.terminal');
    terminal.classList.add('correct');
    setTimeout(() => {
        terminal.classList.remove('correct');
    }, 600); // Match the animation duration
}

// Check the user's answer
function checkAnswer() {
    if (awaitingNext) return;
    if (retryMode) return; // Prevent double submission in retry mode
    const userAnswer = inputField.value;
    const correctAnswer = definitions[currentDefinitionIndex].answer;

    // Prevent empty input from being submitted
    if (userAnswer === "") {
        outputField.innerHTML = `
            <div class="terminal-feedback">
                <span style="color:#50fa7b">user@admin</span><span style="color:#fff">:</span><span style="color:#8be9fd">Definition</span><span style="color:#fff">$</span> ${definitions[currentDefinitionIndex].definition}<br>
                <span style="color:#50fa7b">user@admin</span><span style="color:#fff">:</span><span style="color:#8be9fd">No-User-Input</span><span style="color:#fff">$</span> Please enter an answer before submitting.
            </div>
        `;
        inputField.focus();
        return;
    }

    // Require exact match (case-sensitive, no trimming)
    const isCorrect = userAnswer === correctAnswer;

    if (isCorrect) {
        markCorrect(currentDefinitionIndex);
        showCorrectFeedback();
        showFeedback(`
            <div class="terminal-feedback correct-feedback">
                <span style='color:#50fa7b'>Correct!</span>
                <span style='color:#f1fa8c'><br>${definitions[currentDefinitionIndex].answer} is correct because: ${definitions[currentDefinitionIndex].definition}</span>
            </div>
        `, '#50fa7b');
        inputField.disabled = true;           // Disable typing, but keep input visible
        submitButton.style.display = 'none';  // Hide submit button
        awaitingNext = true;
        showNextButton();
    } else {
        markIncorrect(currentDefinitionIndex);
        showIncorrectFeedback();
        // Hide submit button
        submitButton.style.display = 'none';
        retryMode = true;
        // Show feedback with correct answer and Retry button
        const explanation = definitions[currentDefinitionIndex].incorrectExplanation || "Hint: Review the definition carefully and try again.";
        outputField.innerHTML = `
            <div class="terminal-feedback">
                <span style="color:#8be9fd">Definition:</span> ${definitions[currentDefinitionIndex].definition}<br>
                <span style='color:#ff5555'>Incorrect.</span> <span style='color:#f1fa8c'>${userAnswer} is not the correct answer.</span><br>
                <span style='color:#ffb86c'>${explanation}</span><br>
                <span style='color:#bd93f9'>Correct answer: <b>${definitions[currentDefinitionIndex].answer}</b></span><br>
                <button id='retry-btn' class='retry-btn'>Retry</button>
            </div>
        `;

        setTimeout(() => {
            const retryBtn = document.getElementById('retry-btn');
            if (retryBtn) {
                retryBtn.onclick = doRetry;
            }
        }, 0);
        inputField.disabled = false;
        inputField.focus();
    }
}

// Retry the current question
function doRetry() {
    inputField.value = '';
    outputField.innerHTML = `
        <div class="terminal-feedback">
            <span style="color:#50fa7b">user@admin</span><span style="color:#fff">:</span><span style="color:#8be9fd">Definition</span><span style="color:#fff">$</span> ${definitions[currentDefinitionIndex].definition}<span class="blinking-cursor">&#9608;</span>
        </div>
    `;
    submitButton.style.display = '';
    inputField.focus();
    retryMode = false;
}

// Function to simulate typing effect for dynamic text
function typeText(element, text, speed = 50) {
    let index = 0;
    element.innerHTML = ""; // Clear existing content
    const interval = setInterval(() => {
        if (index < text.length) {
            element.innerHTML += text[index];
            index++;
        } else {
            clearInterval(interval);
        }
    }, speed);
}

// Event listener for the submit button
submitButton.addEventListener('click', checkAnswer);

// Event listener for the Enter key
inputField.addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        if (retryMode) {
            doRetry();
        } else if (awaitingNext) {
            // Simulate clicking the Next Question button
            const nextBtn = document.getElementById('nextBtn');
            if (nextBtn) {
                nextBtn.click();
            }
        } else {
            checkAnswer();
        }
    }
});

// Allow pressing Enter to submit the answer
inputField.addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Prevent unwanted behavior
        submitButton.click();   // Trigger the submit button's click event
    }
});


