const emailjs = require('@emailjs/nodejs');

// Initialize EmailJS configuration
const getEmailConfig = () => ({
    serviceID: process.env.VITE_EMAILJS_SERVICE_ID,
    templateID: process.env.VITE_EMAILJS_TEMPLATE_ID,
    publicKey: process.env.VITE_EMAILJS_PUBLIC_KEY
});

const isEmailConfigured = () => {
    const config = getEmailConfig();
    return !!(config.serviceID && config.templateID && config.publicKey);
};

// Format current date and time
const getCurrentDateTime = () => {
    const now = new Date();
    return now.toLocaleString('en-IN', { 
        day: 'numeric', 
        month: 'numeric', 
        year: 'numeric', 
        hour: 'numeric', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: true
    });
};

// Send email with complete formatting
const sendFormattedEmail = async (emailConfig, recipientEmail, subject, message) => {
    const sentOn = getCurrentDateTime();
    const formattedMessage = `${subject}\n\nIssued By:\nE-School Admin\n\nSent on: ${sentOn}\n\n${message}`;
    
    await emailjs.send(emailConfig.serviceID, emailConfig.templateID, {
        to_email: recipientEmail,
        task_name: subject,
        subject: subject,
        issued_by: 'E-School Admin',
        sent_on: sentOn,
        message: formattedMessage
    }, { publicKey: emailConfig.publicKey });
};

async function sendReminderEmail(userEmail, todoText, reminderDate) {
    try {
        if (!isEmailConfigured()) {
            console.warn('[EMAIL] EmailJS not configured. Skipping reminder email.');
            return;
        }

        const config = getEmailConfig();
        const subject = `Reminder: ${todoText}`;
        const message = `Your reminder for "${todoText}" is due on ${reminderDate}`;

        await sendFormattedEmail(config, userEmail, subject, message);
        console.log(`[EMAIL] Reminder sent to ${userEmail}`);
    } catch (error) {
        console.error(`[EMAIL] Failed to send reminder to ${userEmail}:`, error.message);
    }
}

async function sendAssignmentNotification(recipientEmails, assignmentTitle, dueDate, description, classroomName) {
    try {
        if (!isEmailConfigured()) {
            console.warn('[EMAIL] EmailJS not configured. Skipping assignment notification.');
            return;
        }

        if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
            console.warn('[EMAIL] No recipient emails for assignment notification.');
            return;
        }

        const config = getEmailConfig();
        const dueStr = dueDate ? new Date(dueDate).toLocaleDateString() : 'Not specified';
        const subject = `📚 New Assignment: ${assignmentTitle}`;
        const message = `A new assignment "${assignmentTitle}" has been assigned in ${classroomName}.\n\nDue Date: ${dueStr}\n\nDetails: ${description || 'No description provided'}\n\nPlease log in to the E-School platform to view and complete this assignment.`;

        for (const email of recipientEmails) {
            try {
                await sendFormattedEmail(config, email, subject, message);
                console.log(`[EMAIL] Assignment notification sent to ${email}`);
            } catch (innerError) {
                console.error(`[EMAIL] Failed to send assignment notification to ${email}:`, innerError.message);
            }
        }
    } catch (error) {
        console.error(`[EMAIL] Error in sendAssignmentNotification:`, error.message);
    }
}

async function sendQuizNotification(recipientEmails, quizTitle, module, timeLimit, classroomName) {
    try {
        if (!isEmailConfigured()) {
            console.warn('[EMAIL] EmailJS not configured. Skipping quiz notification.');
            return;
        }

        if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
            console.warn('[EMAIL] No recipient emails for quiz notification.');
            return;
        }

        const config = getEmailConfig();
        const subject = `📝 New Quiz: ${quizTitle}`;
        const message = `A new quiz "${quizTitle}" has been assigned in ${classroomName}.\n\nModule: ${module}\nTime Limit: ${timeLimit} minutes\n\nPlease log in to the E-School platform to take this quiz.`;

        for (const email of recipientEmails) {
            try {
                await sendFormattedEmail(config, email, subject, message);
                console.log(`[EMAIL] Quiz notification sent to ${email}`);
            } catch (innerError) {
                console.error(`[EMAIL] Failed to send quiz notification to ${email}:`, innerError.message);
            }
        }
    } catch (error) {
        console.error(`[EMAIL] Error in sendQuizNotification:`, error.message);
    }
}

async function sendSubmissionNotification(teacherEmail, studentEmail, assignmentTitle, classroomName) {
    try {
        if (!isEmailConfigured()) {
            console.warn('[EMAIL] EmailJS not configured. Skipping submission notification.');
            return;
        }

        const config = getEmailConfig();
        const subject = `✅ Assignment Submitted: ${assignmentTitle}`;
        const message = `Student ${studentEmail} has submitted their work for assignment "${assignmentTitle}" in ${classroomName}.\n\nPlease log in to review and grade their submission.`;

        await sendFormattedEmail(config, teacherEmail, subject, message);
        console.log(`[EMAIL] Submission notification sent to teacher ${teacherEmail}`);
    } catch (error) {
        console.error(`[EMAIL] Failed to send submission notification:`, error.message);
    }
}

async function sendGradingNotification(studentEmail, assignmentTitle, marks, feedback, classroomName) {
    try {
        if (!isEmailConfigured()) {
            console.warn('[EMAIL] EmailJS not configured. Skipping grading notification.');
            return;
        }

        const config = getEmailConfig();
        const subject = `📊 Assignment Graded: ${assignmentTitle}`;
        const feedbackText = feedback ? `\n\nFeedback: ${feedback}` : '';
        const message = `Your assignment "${assignmentTitle}" in ${classroomName} has been graded.\n\nMarks: ${marks}${feedbackText}\n\nLog in to the E-School platform to view your full submission.`;
        
        await sendFormattedEmail(config, studentEmail, subject, message);
        console.log(`[EMAIL] Grading notification sent to ${studentEmail}`);
    } catch (error) {
        console.error(`[EMAIL] Failed to send grading notification:`, error.message);
    }
}

async function sendClassroomTaskNotification(recipientEmails, taskText, classroomName) {
    try {
        if (!isEmailConfigured()) {
            console.warn('[EMAIL] EmailJS not configured. Skipping classroom task notification.');
            return;
        }

        if (!Array.isArray(recipientEmails) || recipientEmails.length === 0) {
            console.warn('[EMAIL] No recipient emails for classroom task notification.');
            return;
        }

        const config = getEmailConfig();
        const subject = `✏️ New Classroom Task: ${classroomName}`;
        const message = `A new task has been added to classroom "${classroomName}":\n\n${taskText}\n\nPlease log in to the E-School platform to view all classroom tasks.`;

        for (const email of recipientEmails) {
            try {
                await sendFormattedEmail(config, email, subject, message);
                console.log(`[EMAIL] Classroom task notification sent to ${email}`);
            } catch (innerError) {
                console.error(`[EMAIL] Failed to send classroom task notification to ${email}:`, innerError.message);
            }
        }
    } catch (error) {
        console.error(`[EMAIL] Error in sendClassroomTaskNotification:`, error.message);
    }
}

async function sendClassroomWelcomeEmail(studentEmail, classroomName, teacherName) {
    try {
        if (!isEmailConfigured()) {
            console.warn('[EMAIL] EmailJS not configured. Skipping classroom welcome email.');
            return;
        }

        const config = getEmailConfig();
        const subject = `🏆 Welcome to Classroom!`;
        const message = `You have been added to the classroom "${classroomName}" by ${teacherName}.\n\nLog in to see your assignments and get started with your coursework!`;

        await sendFormattedEmail(config, studentEmail, subject, message);
        console.log(`[EMAIL] Classroom welcome email sent to ${studentEmail}`);
    } catch (error) {
        console.error(`[EMAIL] Failed to send classroom welcome email:`, error.message);
    }
}

module.exports = {
    sendReminderEmail,
    sendAssignmentNotification,
    sendQuizNotification,
    sendSubmissionNotification,
    sendGradingNotification,
    sendClassroomTaskNotification,
    sendClassroomWelcomeEmail
};
