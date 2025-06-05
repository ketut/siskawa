// This file contains client-side JavaScript code for handling user interactions, sending requests to the server, and updating the UI in real-time.

let ws;
let connectionStatus = document.getElementById('connection-status');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing application...');
    
    // Setup navigation click handlers
    setupNavigation();
    
    // Initialize WebSocket connection
    initWebSocket();
    
    // Load initial data
    setTimeout(() => {
        loadMessageLogs();
        loadFailedMessages();
    }, 1000);
    
    // Refresh data every 30 seconds
    setInterval(() => {
        loadMessageLogs();
        loadFailedMessages();
    }, 30000);
    
    // Setup form handlers
    setupFormHandlers();
});

// Update bagian setupNavigation untuk menambahkan auto-refresh ketika berpindah section
function setupNavigation() {
    console.log('Setting up navigation...');
    
    // Add click handlers to all navigation links
    const navLinks = document.querySelectorAll('.nav-link[data-section]');
    console.log('Found navigation links:', navLinks.length);
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            console.log('Navigation clicked:', sectionId);
            showSection(sectionId);
            
            // Auto-refresh data when navigating to specific sections
            if (sectionId === 'message-logs') {
                loadMessageLogs();
            } else if (sectionId === 'failed-messages') {
                loadFailedMessages();
            } else if (sectionId === 'dashboard') {
                loadQRCode();
            } else if (sectionId === 'contacts') {
                loadContacts();
            } else if (sectionId === 'import-contacts') {
                loadContactGroups();
            }
        });
    });
}

// Send single message form handler
function setupFormHandlers() {
    // Send single message form handler
    const sendMessageForm = document.getElementById('send-message-form');
    if (sendMessageForm) {
        sendMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const recipient = document.getElementById('recipient')?.value;
            const message = document.getElementById('message')?.value;
            
            console.log('Sending message to:', recipient);
            console.log('Message content:', message);
            
            // Disable submit button to prevent double submission
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            
            try {
                const requestData = { to: recipient, message: message };
                console.log('Request data:', requestData);
                
                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                console.log('Response status:', response.status);
                
                const result = await response.json();
                console.log('Response data:', result);
                
                if (result.success) {
                    showToast('Success', 'Message sent successfully!', 'success');
                    sendMessageForm.reset();
                } else {
                    console.error('API returned error:', result.error);
                    showToast('Error', result.error || 'Failed to send message', 'error');
                }
            } catch (error) {
                console.error('Send message error:', error);
                showToast('Error', `Network error: ${error.message}`, 'error');
            } finally {
                // Re-enable submit button
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // Send bulk messages form handler with corrected ID
    const bulkMessageForm = document.getElementById('bulk-message-form');
    if (bulkMessageForm) {
        console.log('Bulk message form found');
        
        bulkMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Use the correct ID for bulk message content
            const recipientsElement = document.getElementById('recipients');
            const messageElement = document.getElementById('bulk-message-content'); // Changed ID
            const intervalElement = document.getElementById('interval');
            
            console.log('Recipients element:', recipientsElement);
            console.log('Message element:', messageElement);
            console.log('Interval element:', intervalElement);
            
            const recipientsText = recipientsElement?.value;
            const message = messageElement?.value; // Now should get the correct value
            const interval = parseInt(intervalElement?.value || '1');
            
            console.log('Raw recipients text:', recipientsText);
            console.log('Message:', message);
            console.log('Interval:', interval);
            
            // Validate inputs
            if (!recipientsText || !recipientsText.trim()) {
                showToast('Error', 'Please enter at least one phone number', 'error');
                return;
            }
            
            if (!message || !message.trim()) {
                showToast('Error', 'Please enter a message', 'error');
                return;
            }
            
            // Parse recipients
            const recipients = recipientsText
                .split('\n')
                .map(r => r.trim())
                .filter(r => r.length > 0);
            
            console.log('Parsed recipients:', recipients);
            
            if (recipients.length === 0) {
                showToast('Error', 'No valid phone numbers found', 'error');
                return;
            }
            
            // Validate phone numbers
            const invalidNumbers = recipients.filter(num => {
                const cleaned = num.replace(/\s+/g, '');
                return !/^\+\d{10,15}$/.test(cleaned);
            });
            
            if (invalidNumbers.length > 0) {
                showToast('Error', `Invalid phone numbers: ${invalidNumbers.join(', ')}`, 'error');
                return;
            }
            
            const requestData = {
                recipients: recipients,
                message: message.trim(),
                interval: interval * 1000
            };
            
            console.log('Sending bulk message request:', requestData);
            
            // Disable submit button
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            
            try {
                const response = await fetch('/api/send-bulk-messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                const result = await response.json();
                console.log('Response data:', result);
                
                if (result.success) {
                    showToast('Success', `Bulk messages queued for ${recipients.length} recipients!`, 'success');
                    bulkMessageForm.reset();
                } else {
                    showToast('Error', result.error || 'Failed to queue bulk messages', 'error');
                }
            } catch (error) {
                console.error('Bulk message error:', error);
                showToast('Error', 'Network error occurred', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    } else {
        console.error('Bulk message form not found!');
    }

    // Manual import form handler
    const manualImportForm = document.getElementById('manual-import-form');
    if (manualImportForm) {
        manualImportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await importManualContacts();
        });
    }
}

// Initialize WebSocket connection
function initWebSocket() {
    console.log('Attempting to connect to WebSocket...');
    ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = function() {
        console.log('WebSocket connected successfully');
        updateConnectionStatus('WebSocket Connected', 'info');
    };
    
    ws.onmessage = function(event) {
        console.log('WebSocket message received:', event.data);
        
        try {
            const data = JSON.parse(event.data);
            console.log('Parsed WebSocket data:', data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    ws.onclose = function() {
        console.log('WebSocket disconnected');
        updateConnectionStatus('WebSocket Disconnected', 'danger');
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            initWebSocket();
        }, 3000);
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus('WebSocket Error', 'danger');
    };
}

// Handle different types of WebSocket messages
function handleWebSocketMessage(data) {
    console.log('Handling WebSocket message type:', data.type);
    
    switch(data.type) {
        case 'qr_code':
            console.log('QR code received:', data.data);
            displayQRCode(data.data.qrCode);
            updateConnectionStatus('Scan QR Code', 'warning');
            break;
        case 'connection_status':
            console.log('Connection status update:', data.data);
            handleConnectionStatus(data.data);
            break;
        case 'incoming_message':
            console.log('Incoming message:', data.data);
            displayIncomingMessage(data.data);
            break;
        case 'bulk_progress':
            console.log('Bulk progress update:', data.data);
            updateBulkProgress(data.data);
            break;
        case 'connection':
            console.log('WebSocket connection established:', data.message);
            break;
        default:
            console.log('Unknown message type:', data.type, data);
    }
}

// Display QR Code
function displayQRCode(qrCodeDataURL) {
    console.log('Displaying QR code');
    const qrContainer = document.getElementById('qr-code-container');
    const instructions = document.getElementById('connection-instructions');
    const successAlert = document.getElementById('connection-success');
    
    if (!qrContainer) {
        console.error('QR container not found');
        return;
    }
    
    if (successAlert) successAlert.style.display = 'none';
    if (instructions) instructions.style.display = 'block';
    
    qrContainer.innerHTML = `
        <img src="${qrCodeDataURL}" alt="WhatsApp QR Code" class="img-fluid" style="max-width: 300px; border: 1px solid #ddd; border-radius: 8px;">
        <p class="mt-3">Scan this QR code with your WhatsApp to connect</p>
    `;
    
    console.log('QR code displayed successfully');
}

// Handle connection status updates
function handleConnectionStatus(statusData) {
    const { status, message } = statusData;
    console.log('Handling connection status:', status, message);
    
    switch(status) {
        case 'connected':
            updateConnectionStatus('Connected', 'success');
            showConnectionSuccess();
            showToast('Success', 'WhatsApp connected successfully!', 'success');
            break;
        case 'connecting':
            updateConnectionStatus('Connecting...', 'warning');
            break;
        case 'disconnected':
            updateConnectionStatus('Disconnected', 'danger');
            hideConnectionSuccess();
            break;
        case 'qr_generated':
            updateConnectionStatus('QR Generated', 'info');
            break;
    }
}

// Show connection success
function showConnectionSuccess() {
    console.log('Showing connection success');
    const qrContainer = document.getElementById('qr-code-container');
    const instructions = document.getElementById('connection-instructions');
    const successAlert = document.getElementById('connection-success');
    
    if (qrContainer) qrContainer.innerHTML = '<i class="fas fa-check-circle text-success" style="font-size: 4rem;"></i>';
    if (instructions) instructions.style.display = 'none';
    if (successAlert) successAlert.style.display = 'block';
}

// Hide connection success
function hideConnectionSuccess() {
    const successAlert = document.getElementById('connection-success');
    if (successAlert) successAlert.style.display = 'none';
}

// Update connection status badge
function updateConnectionStatus(text, type) {
    const statusClasses = {
        'success': 'bg-success',
        'danger': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info',
        'secondary': 'bg-secondary'
    };
    
    if (connectionStatus) {
        connectionStatus.textContent = text;
        connectionStatus.className = `badge ${statusClasses[type] || 'bg-secondary'}`;
    }
}

// Show specific section
function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        console.log('Section displayed:', sectionId);
    } else {
        console.error('Section not found:', sectionId);
    }
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const targetLink = document.querySelector(`[data-section="${sectionId}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
        console.log('Active link updated:', sectionId);
    }
    
    // Load QR code when connection section is shown
    if (sectionId === 'connection') {
        console.log('Loading QR code for connection section');
        setTimeout(() => {
            loadQRCode();
        }, 100);
    }
}

// Load QR Code with better error handling
async function loadQRCode() {
    console.log('Loading QR code from API...');
    const qrContainer = document.getElementById('qr-code-container');
    
    if (!qrContainer) {
        console.error('QR container not found');
        return;
    }

    try {
        const response = await fetch('/api/qr-code');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('QR code API response:', result);
        
        if (result.success) {
            switch(result.connectionState) {
                case 'connected':
                    showConnectionSuccess();
                    break;
                case 'qr_generated':
                    if (result.qrCode) {
                        displayQRCode(result.qrCode);
                    } else {
                        qrContainer.innerHTML = `
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                QR code not available yet. Please wait...
                            </div>
                        `;
                    }
                    break;
                case 'connecting':
                    qrContainer.innerHTML = `
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3">Connecting to WhatsApp...</p>
                    `;
                    break;
                case 'error':
                    qrContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle"></i>
                            Connection error. Retrying...
                        </div>
                        <button class="btn btn-primary mt-2" onclick="reconnectWhatsApp()">
                            <i class="fas fa-sync"></i> Try Again
                        </button>
                    `;
                    break;
                default:
                    qrContainer.innerHTML = `
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3">${result.message || 'Initializing connection...'}</p>
                    `;
            }
        } else {
            console.error('QR code API error:', result.error);
            qrContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i>
                    Error: ${result.error}
                </div>
                <button class="btn btn-primary mt-2" onclick="loadQRCode()">
                    <i class="fas fa-sync"></i> Retry
                </button>
            `;
        }
    } catch (error) {
        console.error('Error loading QR code:', error);
        qrContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle"></i>
                Network error: ${error.message}
            </div>
            <button class="btn btn-primary mt-2" onclick="loadQRCode()">
                <i class="fas fa-sync"></i> Retry
            </button>
        `;
    }
}

// Display incoming message
function displayIncomingMessage(message) {
    const messagesContainer = document.getElementById('incoming-messages');
    
    if (!messagesContainer) {
        console.error('Messages container not found');
        return;
    }
    
    // Remove "No messages yet..." text if it exists
    const noMessagesText = messagesContainer.querySelector('.text-muted');
    if (noMessagesText) {
        noMessagesText.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'alert alert-info mb-2';
    messageElement.innerHTML = `
        <div class="d-flex justify-content-between">
            <div>
                <strong>From:</strong> ${message.sender}<br>
                <strong>Message:</strong> ${message.content}
            </div>
            <small>${new Date(message.timestamp).toLocaleString()}</small>
        </div>
    `;
    
    messagesContainer.insertBefore(messageElement, messagesContainer.firstChild);
    
    // Keep only last 50 messages
    while (messagesContainer.children.length > 50) {
        messagesContainer.removeChild(messagesContainer.lastChild);
    }
}

// Update bulk message progress
function updateBulkProgress(progressData) {
    const { current, total, recipient, success } = progressData;
    const progressContainer = document.getElementById('bulk-progress');
    const progressBar = progressContainer?.querySelector('.progress-bar');
    const progressText = document.getElementById('bulk-progress-text');
    
    if (!progressContainer || !progressBar || !progressText) {
        console.error('Progress elements not found');
        return;
    }
    
    const percentage = (current / total) * 100;
    
    progressContainer.style.display = 'block';
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${Math.round(percentage)}%`;
    progressText.textContent = `${current} / ${total} messages sent (Last: ${recipient} - ${success ? 'Success' : 'Failed'})`;
    
    if (current === total) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
            showToast('Complete', 'Bulk message sending completed!', 'success');
        }, 2000);
    }
}

// Show toast notification
function showToast(title, message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastTitle || !toastMessage) {
        console.error('Toast elements not found');
        return;
    }
    
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Set toast color based on type
    const colorClasses = {
        'error': 'bg-danger text-white',
        'success': 'bg-success text-white',
        'warning': 'bg-warning text-dark',
        'info': 'bg-info text-white'
    };
    
    toast.className = `toast ${colorClasses[type] || ''}`;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Global functions for button onclick handlers
window.refreshQRCode = async function() {
    console.log('Refreshing QR code...');
    const qrContainer = document.getElementById('qr-code-container');
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Refreshing QR code...</p>
        `;
    }
    
    await loadQRCode();
};

// Improved reconnect function
window.reconnectWhatsApp = async function() {
    console.log('Reconnecting WhatsApp...');
    updateConnectionStatus('Reconnecting...', 'warning');
    
    const qrContainer = document.getElementById('qr-code-container');
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Reconnecting...</p>
        `;
    }
    
    try {
        const response = await fetch('/api/reconnect', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Info', 'Reconnection initiated, please wait...', 'info');
            
            // Poll for QR code after reconnection
            setTimeout(() => {
                loadQRCode();
            }, 2000);
        } else {
            showToast('Error', result.error || 'Failed to reconnect', 'error');
            updateConnectionStatus('Reconnect Failed', 'danger');
        }
    } catch (error) {
        console.error('Reconnect error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
        updateConnectionStatus('Reconnect Failed', 'danger');
    }
};

// Load message logs
window.loadMessageLogs = async function() {
    console.log('Loading message logs...');
    try {
        const response = await fetch('/api/message-logs');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Message logs response:', result);
        
        if (result.success) {
            const tableBody = document.getElementById('message-logs-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                
                if (!result.data || result.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No messages found</td></tr>';
                    return;
                }
                
                result.data.forEach(message => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(message.timestamp).toLocaleString()}</td>
                        <td>${message.sender}</td>
                        <td>${message.recipient}</td>
                        <td>${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}</td>
                        <td><span class="badge bg-${message.status === 'sent' ? 'success' : message.status === 'failed' ? 'danger' : 'warning'}">${message.status}</span></td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        } else {
            console.error('API error:', result.error);
            showToast('Error', result.error || 'Failed to load message logs', 'error');
        }
    } catch (error) {
        console.error('Load message logs error:', error);
        showToast('Error', `Failed to load message logs: ${error.message}`, 'error');
        
        // Show error in table
        const tableBody = document.getElementById('message-logs-table');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
};

// Load failed messages
window.loadFailedMessages = async function() {
    console.log('Loading failed messages...');
    try {
        const response = await fetch('/api/failed-transactions');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Failed messages response:', result);
        
        if (result.success) {
            const tableBody = document.getElementById('failed-messages-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                
                if (!result.data || result.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No failed messages found</td></tr>';
                    return;
                }
                
                result.data.forEach(transaction => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(transaction.timestamp).toLocaleString()}</td>
                        <td>${transaction.message_id || transaction.messageId}</td>
                        <td><span class="badge bg-danger">${transaction.status}</span></td>
                        <td>${transaction.error_message || transaction.errorMessage || 'N/A'}</td>
                        <td>${transaction.retry_count || transaction.retryCount || 0}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="retryMessage('${transaction.id}')">
                                <i class="fas fa-redo"></i> Retry
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        } else {
            console.error('API error:', result.error);
            showToast('Error', result.error || 'Failed to load failed messages', 'error');
        }
    } catch (error) {
        console.error('Load failed messages error:', error);
        showToast('Error', `Failed to load failed messages: ${error.message}`, 'error');
        
        // Show error in table
        const tableBody = document.getElementById('failed-messages-table');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
};

// Add manual refresh buttons functionality
window.refreshMessageLogs = function() {
    showToast('Info', 'Refreshing message logs...', 'info');
    loadMessageLogs();
};

window.refreshFailedMessages = function() {
    showToast('Info', 'Refreshing failed messages...', 'info');
    loadFailedMessages();
};

// Add retry message functionality
window.retryMessage = async function(transactionId) {
    console.log('Retrying message:', transactionId);
    
    try {
        const response = await fetch('/api/retry-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transactionId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Success', 'Message retry initiated!', 'success');
            // Refresh failed messages list
            setTimeout(() => {
                loadFailedMessages();
            }, 1000);
        } else {
            showToast('Error', result.error || 'Failed to retry message', 'error');
        }
    } catch (error) {
        console.error('Retry message error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
    }
};

// Contact Management Functions
window.loadContacts = async function() {
    console.log('Loading contacts...');
    try {
        const response = await fetch('/api/contacts');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Contacts response:', result);
        
        if (result.success) {
            const tableBody = document.getElementById('contacts-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                
                if (!result.data || result.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No contacts found</td></tr>';
                    return;
                }
                
                result.data.forEach(contact => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${contact.name}</td>
                        <td>${contact.phone}</td>
                        <td>${contact.group_name || '-'}</td>
                        <td class="text-truncate" style="max-width: 200px;" title="${contact.notes || ''}">${contact.notes || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="sendMessageToContact('${contact.phone}', '${contact.name}')">
                                <i class="fas fa-paper-plane"></i> Send
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteContact('${contact.id}', '${contact.name}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }
            
            // Load contact groups for filter
            loadContactGroups();
        } else {
            console.error('API error:', result.error);
            showToast('Error', result.error || 'Failed to load contacts', 'error');
        }
    } catch (error) {
        console.error('Load contacts error:', error);
        showToast('Error', `Failed to load contacts: ${error.message}`, 'error');
        
        const tableBody = document.getElementById('contacts-table');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
};

window.loadContactGroups = async function() {
    try {
        const response = await fetch('/api/contact-groups');
        const result = await response.json();
        
        if (result.success) {
            const groupFilter = document.getElementById('group-filter');
            if (groupFilter) {
                // Keep "All Groups" option
                groupFilter.innerHTML = '<option value="">All Groups</option>';
                
                result.data.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.name;
                    option.textContent = group.name;
                    groupFilter.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading contact groups:', error);
    }
};

window.filterContacts = async function() {
    const searchQuery = document.getElementById('contact-search')?.value.trim();
    const groupFilter = document.getElementById('group-filter')?.value;
    
    console.log('Filtering contacts:', { search: searchQuery, group: groupFilter });
    
    try {
        let url = '/api/contacts?';
        const params = new URLSearchParams();
        
        if (searchQuery) {
            params.append('search', searchQuery);
        }
        if (groupFilter) {
            params.append('group', groupFilter);
        }
        
        const response = await fetch(url + params.toString());
        const result = await response.json();
        
        if (result.success) {
            const tableBody = document.getElementById('contacts-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                
                if (!result.data || result.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No contacts found matching criteria</td></tr>';
                    return;
                }
                
                result.data.forEach(contact => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${contact.name}</td>
                        <td>${contact.phone}</td>
                        <td>${contact.group_name || '-'}</td>
                        <td class="text-truncate" style="max-width: 200px;" title="${contact.notes || ''}">${contact.notes || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="sendMessageToContact('${contact.phone}', '${contact.name}')">
                                <i class="fas fa-paper-plane"></i> Send
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteContact('${contact.id}', '${contact.name}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('Filter contacts error:', error);
        showToast('Error', 'Failed to filter contacts', 'error');
    }
};

window.addContact = async function() {
    const name = document.getElementById('contact-name')?.value.trim();
    const phone = document.getElementById('contact-phone')?.value.trim();
    const group = document.getElementById('contact-group')?.value.trim();
    const notes = document.getElementById('contact-notes')?.value.trim();
    
    if (!name || !phone) {
        showToast('Error', 'Name and phone number are required', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/import-contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contacts: [{
                    name: name,
                    phone: phone,
                    group: group || null,
                    notes: notes || null
                }]
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Success', 'Contact added successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addContactModal'));
            modal.hide();
            
            // Clear form
            document.getElementById('add-contact-form').reset();
            
            // Reload contacts
            loadContacts();
        } else {
            showToast('Error', result.error || 'Failed to add contact', 'error');
        }
    } catch (error) {
        console.error('Add contact error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
    }
};

window.deleteContact = async function(contactId, contactName) {
    if (!confirm(`Are you sure you want to delete contact "${contactName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/contacts/${contactId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Success', 'Contact deleted successfully!', 'success');
            loadContacts();
        } else {
            showToast('Error', result.error || 'Failed to delete contact', 'error');
        }
    } catch (error) {
        console.error('Delete contact error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
    }
};

window.sendMessageToContact = function(phone, name) {
    // Switch to send message section
    showSection('send-message');
    
    // Fill in the phone number
    const recipientField = document.getElementById('recipient');
    if (recipientField) {
        recipientField.value = phone;
    }
    
    // Focus on message field
    const messageField = document.getElementById('message');
    if (messageField) {
        messageField.focus();
        messageField.placeholder = `Type your message to ${name}...`;
    }
    
    showToast('Info', `Ready to send message to ${name}`, 'info');
};

// Import Functions
window.importManualContacts = async function() {
    const groupName = document.getElementById('group-name')?.value.trim();
    const contactsInput = document.getElementById('contacts-input')?.value.trim();
    
    if (!contactsInput) {
        showToast('Error', 'Please enter contacts data', 'error');
        return;
    }
    
    const lines = contactsInput.split('\n').filter(line => line.trim().length > 0);
    const contacts = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const parts = line.split('|').map(part => part.trim());
        
        if (parts.length < 2) {
            errors.push(`Line ${index + 1}: Invalid format. Use: Name | Phone | Notes`);
            return;
        }
        
        const [name, phone, notes] = parts;
        
        if (!name || !phone) {
            errors.push(`Line ${index + 1}: Name and phone are required`);
            return;
        }
        
        contacts.push({
            name: name,
            phone: phone,
            group: groupName || null,
            notes: notes || null
        });
    });
    
    if (errors.length > 0) {
        showToast('Error', `Found errors:\n${errors.slice(0, 5).join('\n')}`, 'error');
        return;
    }
    
    if (contacts.length === 0) {
        showToast('Error', 'No valid contacts found', 'error');
        return;
    }
    
    await importContactsData(contacts, 'Manual Input');
};

window.importCSV = async function() {
    const fileInput = document.getElementById('csv-file');
    const file = fileInput?.files[0];
    
    if (!file) {
        showToast('Error', 'Please select a CSV file', 'error');
        return;
    }
    
    try {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        if (lines.length < 2) {
            showToast('Error', 'CSV file must have at least a header and one data row', 'error');
            return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const nameIndex = headers.findIndex(h => h.includes('name'));
        const phoneIndex = headers.findIndex(h => h.includes('phone'));
        const groupIndex = headers.findIndex(h => h.includes('group'));
        const notesIndex = headers.findIndex(h => h.includes('notes'));
        
        if (nameIndex === -1 || phoneIndex === -1) {
            showToast('Error', 'CSV must have Name and Phone columns', 'error');
            return;
        }
        
        const contacts = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            
            if (values.length > nameIndex && values.length > phoneIndex) {
                contacts.push({
                    name: values[nameIndex],
                    phone: values[phoneIndex],
                    group: groupIndex >= 0 ? values[groupIndex] : null,
                    notes: notesIndex >= 0 ? values[notesIndex] : null
                });
            }
        }
        
        if (contacts.length === 0) {
            showToast('Error', 'No valid contacts found in CSV', 'error');
            return;
        }
        
        await importContactsData(contacts, 'CSV Upload');
    } catch (error) {
        console.error('CSV import error:', error);
        showToast('Error', 'Error reading CSV file', 'error');
    }
};

window.importJSON = async function() {
    const jsonInput = document.getElementById('json-input')?.value.trim();
    
    if (!jsonInput) {
        showToast('Error', 'Please enter JSON data', 'error');
        return;
    }
    
    try {
        const contacts = JSON.parse(jsonInput);
        
        if (!Array.isArray(contacts)) {
            showToast('Error', 'JSON must be an array of contacts', 'error');
            return;
        }
        
        if (contacts.length === 0) {
            showToast('Error', 'JSON array is empty', 'error');
            return;
        }
        
        // Validate JSON structure
        const invalidContacts = contacts.filter(contact => !contact.name || !contact.phone);
        if (invalidContacts.length > 0) {
            showToast('Error', 'All contacts must have name and phone fields', 'error');
            return;
        }
        
        await importContactsData(contacts, 'JSON Import');
    } catch (error) {
        console.error('JSON import error:', error);
        showToast('Error', 'Invalid JSON format', 'error');
    }
};

async function importContactsData(contacts, method) {
    console.log(`Importing ${contacts.length} contacts via ${method}`);
    
    try {
        const response = await fetch('/api/import-contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contacts })
        });
        
        const result = await response.json();
        console.log('Import result:', result);
        
        if (result.success) {
            showToast('Success', `Successfully imported ${result.imported} contacts!`, 'success');
            
            // Show import results
            showImportResults(result);
            
            // Clear forms
            document.getElementById('contacts-input').value = '';
            document.getElementById('json-input').value = '';
            document.getElementById('csv-file').value = '';
            
            // Reload contacts
            loadContacts();
        } else {
            showToast('Error', result.error || 'Failed to import contacts', 'error');
            
            if (result.invalidContacts) {
                showImportResults(result);
            }
        }
    } catch (error) {
        console.error('Import contacts error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
    }
}

function showImportResults(result) {
    const resultsDiv = document.getElementById('import-results');
    const resultsContent = document.getElementById('import-results-content');
    
    if (resultsDiv && resultsContent) {
        let html = '';
        
        if (result.success && result.imported > 0) {
            html += `<div class="alert alert-success">
                <h6><i class="fas fa-check-circle"></i> Success</h6>
                <p>Successfully imported <strong>${result.imported}</strong> contacts</p>
            </div>`;
        }
        
        if (result.failed > 0 && result.failedContacts) {
            html += `<div class="alert alert-warning">
                <h6><i class="fas fa-exclamation-triangle"></i> Warnings</h6>
                <p><strong>${result.failed}</strong> contacts failed to import:</p>
                <ul>`;
            
            result.failedContacts.slice(0, 10).forEach(failed => {
                html += `<li>${failed.contact.name || 'Unknown'} (${failed.contact.phone || 'No phone'}): ${failed.error}</li>`;
            });
            
            if (result.failedContacts.length > 10) {
                html += `<li>... and ${result.failedContacts.length - 10} more errors</li>`;
            }
            
            html += '</ul></div>';
        }
        
        if (result.invalidContacts) {
            html += `<div class="alert alert-danger">
                <h6><i class="fas fa-times-circle"></i> Validation Errors</h6>
                <ul>`;
            
            result.invalidContacts.forEach(invalid => {
                html += `<li>Contact ${invalid.index}: ${invalid.errors.join(', ')}</li>`;
            });
            
            html += '</ul></div>';
        }
        
        resultsContent.innerHTML = html;
        resultsDiv.style.display = 'block';
        
        // Auto-hide after 10 seconds if successful
        if (result.success && result.failed === 0) {
            setTimeout(() => {
                resultsDiv.style.display = 'none';
            }, 10000);
        }
    }
}

// Update setupFormHandlers untuk manual import
function setupFormHandlers() {
    // Send single message form handler
    const sendMessageForm = document.getElementById('send-message-form');
    if (sendMessageForm) {
        sendMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const recipient = document.getElementById('recipient')?.value;
            const message = document.getElementById('message')?.value;
            
            console.log('Sending message to:', recipient);
            console.log('Message content:', message);
            
            // Disable submit button to prevent double submission
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            
            try {
                const requestData = { to: recipient, message: message };
                console.log('Request data:', requestData);
                
                const response = await fetch('/api/send-message', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                console.log('Response status:', response.status);
                
                const result = await response.json();
                console.log('Response data:', result);
                
                if (result.success) {
                    showToast('Success', 'Message sent successfully!', 'success');
                    sendMessageForm.reset();
                } else {
                    console.error('API returned error:', result.error);
                    showToast('Error', result.error || 'Failed to send message', 'error');
                }
            } catch (error) {
                console.error('Send message error:', error);
                showToast('Error', `Network error: ${error.message}`, 'error');
            } finally {
                // Re-enable submit button
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }

    // Send bulk messages form handler with corrected ID
    const bulkMessageForm = document.getElementById('bulk-message-form');
    if (bulkMessageForm) {
        console.log('Bulk message form found');
        
        bulkMessageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Use the correct ID for bulk message content
            const recipientsElement = document.getElementById('recipients');
            const messageElement = document.getElementById('bulk-message-content'); // Changed ID
            const intervalElement = document.getElementById('interval');
            
            console.log('Recipients element:', recipientsElement);
            console.log('Message element:', messageElement);
            console.log('Interval element:', intervalElement);
            
            const recipientsText = recipientsElement?.value;
            const message = messageElement?.value; // Now should get the correct value
            const interval = parseInt(intervalElement?.value || '1');
            
            console.log('Raw recipients text:', recipientsText);
            console.log('Message:', message);
            console.log('Interval:', interval);
            
            // Validate inputs
            if (!recipientsText || !recipientsText.trim()) {
                showToast('Error', 'Please enter at least one phone number', 'error');
                return;
            }
            
            if (!message || !message.trim()) {
                showToast('Error', 'Please enter a message', 'error');
                return;
            }
            
            // Parse recipients
            const recipients = recipientsText
                .split('\n')
                .map(r => r.trim())
                .filter(r => r.length > 0);
            
            console.log('Parsed recipients:', recipients);
            
            if (recipients.length === 0) {
                showToast('Error', 'No valid phone numbers found', 'error');
                return;
            }
            
            // Validate phone numbers
            const invalidNumbers = recipients.filter(num => {
                const cleaned = num.replace(/\s+/g, '');
                return !/^\+\d{10,15}$/.test(cleaned);
            });
            
            if (invalidNumbers.length > 0) {
                showToast('Error', `Invalid phone numbers: ${invalidNumbers.join(', ')}`, 'error');
                return;
            }
            
            const requestData = {
                recipients: recipients,
                message: message.trim(),
                interval: interval * 1000
            };
            
            console.log('Sending bulk message request:', requestData);
            
            // Disable submit button
            const submitBtn = e.target.querySelector('button[type="submit"]');
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            
            try {
                const response = await fetch('/api/send-bulk-messages', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                const result = await response.json();
                console.log('Response data:', result);
                
                if (result.success) {
                    showToast('Success', `Bulk messages queued for ${recipients.length} recipients!`, 'success');
                    bulkMessageForm.reset();
                } else {
                    showToast('Error', result.error || 'Failed to queue bulk messages', 'error');
                }
            } catch (error) {
                console.error('Bulk message error:', error);
                showToast('Error', 'Network error occurred', 'error');
            } finally {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    } else {
        console.error('Bulk message form not found!');
    }

    // Manual import form handler
    const manualImportForm = document.getElementById('manual-import-form');
    if (manualImportForm) {
        manualImportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await importManualContacts();
        });
    }
}

// Initialize WebSocket connection
function initWebSocket() {
    console.log('Attempting to connect to WebSocket...');
    ws = new WebSocket('ws://localhost:3001');
    
    ws.onopen = function() {
        console.log('WebSocket connected successfully');
        updateConnectionStatus('WebSocket Connected', 'info');
    };
    
    ws.onmessage = function(event) {
        console.log('WebSocket message received:', event.data);
        
        try {
            const data = JSON.parse(event.data);
            console.log('Parsed WebSocket data:', data);
            handleWebSocketMessage(data);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    };
    
    ws.onclose = function() {
        console.log('WebSocket disconnected');
        updateConnectionStatus('WebSocket Disconnected', 'danger');
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
            console.log('Attempting to reconnect WebSocket...');
            initWebSocket();
        }, 3000);
    };
    
    ws.onerror = function(error) {
        console.error('WebSocket error:', error);
        updateConnectionStatus('WebSocket Error', 'danger');
    };
}

// Handle different types of WebSocket messages
function handleWebSocketMessage(data) {
    console.log('Handling WebSocket message type:', data.type);
    
    switch(data.type) {
        case 'qr_code':
            console.log('QR code received:', data.data);
            displayQRCode(data.data.qrCode);
            updateConnectionStatus('Scan QR Code', 'warning');
            break;
        case 'connection_status':
            console.log('Connection status update:', data.data);
            handleConnectionStatus(data.data);
            break;
        case 'incoming_message':
            console.log('Incoming message:', data.data);
            displayIncomingMessage(data.data);
            break;
        case 'bulk_progress':
            console.log('Bulk progress update:', data.data);
            updateBulkProgress(data.data);
            break;
        case 'connection':
            console.log('WebSocket connection established:', data.message);
            break;
        default:
            console.log('Unknown message type:', data.type, data);
    }
}

// Display QR Code
function displayQRCode(qrCodeDataURL) {
    console.log('Displaying QR code');
    const qrContainer = document.getElementById('qr-code-container');
    const instructions = document.getElementById('connection-instructions');
    const successAlert = document.getElementById('connection-success');
    
    if (!qrContainer) {
        console.error('QR container not found');
        return;
    }
    
    if (successAlert) successAlert.style.display = 'none';
    if (instructions) instructions.style.display = 'block';
    
    qrContainer.innerHTML = `
        <img src="${qrCodeDataURL}" alt="WhatsApp QR Code" class="img-fluid" style="max-width: 300px; border: 1px solid #ddd; border-radius: 8px;">
        <p class="mt-3">Scan this QR code with your WhatsApp to connect</p>
    `;
    
    console.log('QR code displayed successfully');
}

// Handle connection status updates
function handleConnectionStatus(statusData) {
    const { status, message } = statusData;
    console.log('Handling connection status:', status, message);
    
    switch(status) {
        case 'connected':
            updateConnectionStatus('Connected', 'success');
            showConnectionSuccess();
            showToast('Success', 'WhatsApp connected successfully!', 'success');
            break;
        case 'connecting':
            updateConnectionStatus('Connecting...', 'warning');
            break;
        case 'disconnected':
            updateConnectionStatus('Disconnected', 'danger');
            hideConnectionSuccess();
            break;
        case 'qr_generated':
            updateConnectionStatus('QR Generated', 'info');
            break;
    }
}

// Show connection success
function showConnectionSuccess() {
    console.log('Showing connection success');
    const qrContainer = document.getElementById('qr-code-container');
    const instructions = document.getElementById('connection-instructions');
    const successAlert = document.getElementById('connection-success');
    
    if (qrContainer) qrContainer.innerHTML = '<i class="fas fa-check-circle text-success" style="font-size: 4rem;"></i>';
    if (instructions) instructions.style.display = 'none';
    if (successAlert) successAlert.style.display = 'block';
}

// Hide connection success
function hideConnectionSuccess() {
    const successAlert = document.getElementById('connection-success');
    if (successAlert) successAlert.style.display = 'none';
}

// Update connection status badge
function updateConnectionStatus(text, type) {
    const statusClasses = {
        'success': 'bg-success',
        'danger': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info',
        'secondary': 'bg-secondary'
    };
    
    if (connectionStatus) {
        connectionStatus.textContent = text;
        connectionStatus.className = `badge ${statusClasses[type] || 'bg-secondary'}`;
    }
}

// Show specific section
function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        console.log('Section displayed:', sectionId);
    } else {
        console.error('Section not found:', sectionId);
    }
    
    // Update active nav link
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    const targetLink = document.querySelector(`[data-section="${sectionId}"]`);
    if (targetLink) {
        targetLink.classList.add('active');
        console.log('Active link updated:', sectionId);
    }
    
    // Load QR code when connection section is shown
    if (sectionId === 'connection') {
        console.log('Loading QR code for connection section');
        setTimeout(() => {
            loadQRCode();
        }, 100);
    }
}

// Load QR Code with better error handling
async function loadQRCode() {
    console.log('Loading QR code from API...');
    const qrContainer = document.getElementById('qr-code-container');
    
    if (!qrContainer) {
        console.error('QR container not found');
        return;
    }

    try {
        const response = await fetch('/api/qr-code');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('QR code API response:', result);
        
        if (result.success) {
            switch(result.connectionState) {
                case 'connected':
                    showConnectionSuccess();
                    break;
                case 'qr_generated':
                    if (result.qrCode) {
                        displayQRCode(result.qrCode);
                    } else {
                        qrContainer.innerHTML = `
                            <div class="alert alert-warning">
                                <i class="fas fa-exclamation-triangle"></i>
                                QR code not available yet. Please wait...
                            </div>
                        `;
                    }
                    break;
                case 'connecting':
                    qrContainer.innerHTML = `
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3">Connecting to WhatsApp...</p>
                    `;
                    break;
                case 'error':
                    qrContainer.innerHTML = `
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle"></i>
                            Connection error. Retrying...
                        </div>
                        <button class="btn btn-primary mt-2" onclick="reconnectWhatsApp()">
                            <i class="fas fa-sync"></i> Try Again
                        </button>
                    `;
                    break;
                default:
                    qrContainer.innerHTML = `
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <p class="mt-3">${result.message || 'Initializing connection...'}</p>
                    `;
            }
        } else {
            console.error('QR code API error:', result.error);
            qrContainer.innerHTML = `
                <div class="alert alert-danger">
                    <i class="fas fa-exclamation-circle"></i>
                    Error: ${result.error}
                </div>
                <button class="btn btn-primary mt-2" onclick="loadQRCode()">
                    <i class="fas fa-sync"></i> Retry
                </button>
            `;
        }
    } catch (error) {
        console.error('Error loading QR code:', error);
        qrContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle"></i>
                Network error: ${error.message}
            </div>
            <button class="btn btn-primary mt-2" onclick="loadQRCode()">
                <i class="fas fa-sync"></i> Retry
            </button>
        `;
    }
}

// Display incoming message
function displayIncomingMessage(message) {
    const messagesContainer = document.getElementById('incoming-messages');
    
    if (!messagesContainer) {
        console.error('Messages container not found');
        return;
    }
    
    // Remove "No messages yet..." text if it exists
    const noMessagesText = messagesContainer.querySelector('.text-muted');
    if (noMessagesText) {
        noMessagesText.remove();
    }
    
    const messageElement = document.createElement('div');
    messageElement.className = 'alert alert-info mb-2';
    messageElement.innerHTML = `
        <div class="d-flex justify-content-between">
            <div>
                <strong>From:</strong> ${message.sender}<br>
                <strong>Message:</strong> ${message.content}
            </div>
            <small>${new Date(message.timestamp).toLocaleString()}</small>
        </div>
    `;
    
    messagesContainer.insertBefore(messageElement, messagesContainer.firstChild);
    
    // Keep only last 50 messages
    while (messagesContainer.children.length > 50) {
        messagesContainer.removeChild(messagesContainer.lastChild);
    }
}

// Update bulk message progress
function updateBulkProgress(progressData) {
    const { current, total, recipient, success } = progressData;
    const progressContainer = document.getElementById('bulk-progress');
    const progressBar = progressContainer?.querySelector('.progress-bar');
    const progressText = document.getElementById('bulk-progress-text');
    
    if (!progressContainer || !progressBar || !progressText) {
        console.error('Progress elements not found');
        return;
    }
    
    const percentage = (current / total) * 100;
    
    progressContainer.style.display = 'block';
    progressBar.style.width = `${percentage}%`;
    progressBar.textContent = `${Math.round(percentage)}%`;
    progressText.textContent = `${current} / ${total} messages sent (Last: ${recipient} - ${success ? 'Success' : 'Failed'})`;
    
    if (current === total) {
        setTimeout(() => {
            progressContainer.style.display = 'none';
            showToast('Complete', 'Bulk message sending completed!', 'success');
        }, 2000);
    }
}

// Show toast notification
function showToast(title, message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastTitle = document.getElementById('toast-title');
    const toastMessage = document.getElementById('toast-message');
    
    if (!toast || !toastTitle || !toastMessage) {
        console.error('Toast elements not found');
        return;
    }
    
    toastTitle.textContent = title;
    toastMessage.textContent = message;
    
    // Set toast color based on type
    const colorClasses = {
        'error': 'bg-danger text-white',
        'success': 'bg-success text-white',
        'warning': 'bg-warning text-dark',
        'info': 'bg-info text-white'
    };
    
    toast.className = `toast ${colorClasses[type] || ''}`;
    
    const bsToast = new bootstrap.Toast(toast);
    bsToast.show();
}

// Global functions for button onclick handlers
window.refreshQRCode = async function() {
    console.log('Refreshing QR code...');
    const qrContainer = document.getElementById('qr-code-container');
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Refreshing QR code...</p>
        `;
    }
    
    await loadQRCode();
};

// Improved reconnect function
window.reconnectWhatsApp = async function() {
    console.log('Reconnecting WhatsApp...');
    updateConnectionStatus('Reconnecting...', 'warning');
    
    const qrContainer = document.getElementById('qr-code-container');
    if (qrContainer) {
        qrContainer.innerHTML = `
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <p class="mt-3">Reconnecting...</p>
        `;
    }
    
    try {
        const response = await fetch('/api/reconnect', { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Info', 'Reconnection initiated, please wait...', 'info');
            
            // Poll for QR code after reconnection
            setTimeout(() => {
                loadQRCode();
            }, 2000);
        } else {
            showToast('Error', result.error || 'Failed to reconnect', 'error');
            updateConnectionStatus('Reconnect Failed', 'danger');
        }
    } catch (error) {
        console.error('Reconnect error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
        updateConnectionStatus('Reconnect Failed', 'danger');
    }
};

// Load message logs
window.loadMessageLogs = async function() {
    console.log('Loading message logs...');
    try {
        const response = await fetch('/api/message-logs');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Message logs response:', result);
        
        if (result.success) {
            const tableBody = document.getElementById('message-logs-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                
                if (!result.data || result.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No messages found</td></tr>';
                    return;
                }
                
                result.data.forEach(message => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(message.timestamp).toLocaleString()}</td>
                        <td>${message.sender}</td>
                        <td>${message.recipient}</td>
                        <td>${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}</td>
                        <td><span class="badge bg-${message.status === 'sent' ? 'success' : message.status === 'failed' ? 'danger' : 'warning'}">${message.status}</span></td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        } else {
            console.error('API error:', result.error);
            showToast('Error', result.error || 'Failed to load message logs', 'error');
        }
    } catch (error) {
        console.error('Load message logs error:', error);
        showToast('Error', `Failed to load message logs: ${error.message}`, 'error');
        
        // Show error in table
        const tableBody = document.getElementById('message-logs-table');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
};

// Load failed messages
window.loadFailedMessages = async function() {
    console.log('Loading failed messages...');
    try {
        const response = await fetch('/api/failed-transactions');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Failed messages response:', result);
        
        if (result.success) {
            const tableBody = document.getElementById('failed-messages-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                
                if (!result.data || result.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="6" class="text-center">No failed messages found</td></tr>';
                    return;
                }
                
                result.data.forEach(transaction => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${new Date(transaction.timestamp).toLocaleString()}</td>
                        <td>${transaction.message_id || transaction.messageId}</td>
                        <td><span class="badge bg-danger">${transaction.status}</span></td>
                        <td>${transaction.error_message || transaction.errorMessage || 'N/A'}</td>
                        <td>${transaction.retry_count || transaction.retryCount || 0}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="retryMessage('${transaction.id}')">
                                <i class="fas fa-redo"></i> Retry
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        } else {
            console.error('API error:', result.error);
            showToast('Error', result.error || 'Failed to load failed messages', 'error');
        }
    } catch (error) {
        console.error('Load failed messages error:', error);
        showToast('Error', `Failed to load failed messages: ${error.message}`, 'error');
        
        // Show error in table
        const tableBody = document.getElementById('failed-messages-table');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
};

// Add manual refresh buttons functionality
window.refreshMessageLogs = function() {
    showToast('Info', 'Refreshing message logs...', 'info');
    loadMessageLogs();
};

window.refreshFailedMessages = function() {
    showToast('Info', 'Refreshing failed messages...', 'info');
    loadFailedMessages();
};

// Add retry message functionality
window.retryMessage = async function(transactionId) {
    console.log('Retrying message:', transactionId);
    
    try {
        const response = await fetch('/api/retry-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ transactionId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Success', 'Message retry initiated!', 'success');
            // Refresh failed messages list
            setTimeout(() => {
                loadFailedMessages();
            }, 1000);
        } else {
            showToast('Error', result.error || 'Failed to retry message', 'error');
        }
    } catch (error) {
        console.error('Retry message error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
    }
};

// Contact Management Functions
window.loadContacts = async function() {
    console.log('Loading contacts...');
    try {
        const response = await fetch('/api/contacts');
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Contacts response:', result);
        
        if (result.success) {
            const tableBody = document.getElementById('contacts-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                
                if (!result.data || result.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No contacts found</td></tr>';
                    return;
                }
                
                result.data.forEach(contact => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${contact.name}</td>
                        <td>${contact.phone}</td>
                        <td>${contact.group_name || '-'}</td>
                        <td class="text-truncate" style="max-width: 200px;" title="${contact.notes || ''}">${contact.notes || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="sendMessageToContact('${contact.phone}', '${contact.name}')">
                                <i class="fas fa-paper-plane"></i> Send
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteContact('${contact.id}', '${contact.name}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }
            
            // Load contact groups for filter
            loadContactGroups();
        } else {
            console.error('API error:', result.error);
            showToast('Error', result.error || 'Failed to load contacts', 'error');
        }
    } catch (error) {
        console.error('Load contacts error:', error);
        showToast('Error', `Failed to load contacts: ${error.message}`, 'error');
        
        const tableBody = document.getElementById('contacts-table');
        if (tableBody) {
            tableBody.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Error loading data: ${error.message}</td></tr>`;
        }
    }
};

window.loadContactGroups = async function() {
    try {
        const response = await fetch('/api/contact-groups');
        const result = await response.json();
        
        if (result.success) {
            const groupFilter = document.getElementById('group-filter');
            if (groupFilter) {
                // Keep "All Groups" option
                groupFilter.innerHTML = '<option value="">All Groups</option>';
                
                result.data.forEach(group => {
                    const option = document.createElement('option');
                    option.value = group.name;
                    option.textContent = group.name;
                    groupFilter.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading contact groups:', error);
    }
};

window.filterContacts = async function() {
    const searchQuery = document.getElementById('contact-search')?.value.trim();
    const groupFilter = document.getElementById('group-filter')?.value;
    
    console.log('Filtering contacts:', { search: searchQuery, group: groupFilter });
    
    try {
        let url = '/api/contacts?';
        const params = new URLSearchParams();
        
        if (searchQuery) {
            params.append('search', searchQuery);
        }
        if (groupFilter) {
            params.append('group', groupFilter);
        }
        
        const response = await fetch(url + params.toString());
        const result = await response.json();
        
        if (result.success) {
            const tableBody = document.getElementById('contacts-table');
            if (tableBody) {
                tableBody.innerHTML = '';
                
                if (!result.data || result.data.length === 0) {
                    tableBody.innerHTML = '<tr><td colspan="5" class="text-center">No contacts found matching criteria</td></tr>';
                    return;
                }
                
                result.data.forEach(contact => {
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>${contact.name}</td>
                        <td>${contact.phone}</td>
                        <td>${contact.group_name || '-'}</td>
                        <td class="text-truncate" style="max-width: 200px;" title="${contact.notes || ''}">${contact.notes || '-'}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary me-1" onclick="sendMessageToContact('${contact.phone}', '${contact.name}')">
                                <i class="fas fa-paper-plane"></i> Send
                            </button>
                            <button class="btn btn-sm btn-outline-danger" onclick="deleteContact('${contact.id}', '${contact.name}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });
            }
        }
    } catch (error) {
        console.error('Filter contacts error:', error);
        showToast('Error', 'Failed to filter contacts', 'error');
    }
};

window.addContact = async function() {
    const name = document.getElementById('contact-name')?.value.trim();
    const phone = document.getElementById('contact-phone')?.value.trim();
    const group = document.getElementById('contact-group')?.value.trim();
    const notes = document.getElementById('contact-notes')?.value.trim();
    
    if (!name || !phone) {
        showToast('Error', 'Name and phone number are required', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/import-contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contacts: [{
                    name: name,
                    phone: phone,
                    group: group || null,
                    notes: notes || null
                }]
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Success', 'Contact added successfully!', 'success');
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addContactModal'));
            modal.hide();
            
            // Clear form
            document.getElementById('add-contact-form').reset();
            
            // Reload contacts
            loadContacts();
        } else {
            showToast('Error', result.error || 'Failed to add contact', 'error');
        }
    } catch (error) {
        console.error('Add contact error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
    }
};

window.deleteContact = async function(contactId, contactName) {
    if (!confirm(`Are you sure you want to delete contact "${contactName}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/contacts/${contactId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showToast('Success', 'Contact deleted successfully!', 'success');
            loadContacts();
        } else {
            showToast('Error', result.error || 'Failed to delete contact', 'error');
 }
    } catch (error) {
        console.error('Delete contact error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
    }
};

window.sendMessageToContact = function(phone, name) {
    // Switch to send message section
    showSection('send-message');
    
    // Fill in the phone number
    const recipientField = document.getElementById('recipient');
    if (recipientField) {
        recipientField.value = phone;
    }
    
    // Focus on message field
    const messageField = document.getElementById('message');
    if (messageField) {
        messageField.focus();
        messageField.placeholder = `Type your message to ${name}...`;
    }
    
    showToast('Info', `Ready to send message to ${name}`, 'info');
};

// Import Functions
window.importManualContacts = async function() {
    const groupName = document.getElementById('group-name')?.value.trim();
    const contactsInput = document.getElementById('contacts-input')?.value.trim();
    
    if (!contactsInput) {
        showToast('Error', 'Please enter contacts data', 'error');
        return;
    }
    
    const lines = contactsInput.split('\n').filter(line => line.trim().length > 0);
    const contacts = [];
    const errors = [];
    
    lines.forEach((line, index) => {
        const parts = line.split('|').map(part => part.trim());
        
        if (parts.length < 2) {
            errors.push(`Line ${index + 1}: Invalid format. Use: Name | Phone | Notes`);
            return;
        }
        
        const [name, phone, notes] = parts;
        
        if (!name || !phone) {
            errors.push(`Line ${index + 1}: Name and phone are required`);
            return;
        }
        
        contacts.push({
            name: name,
            phone: phone,
            group: groupName || null,
            notes: notes || null
        });
    });
    
    if (errors.length > 0) {
        showToast('Error', `Found errors:\n${errors.slice(0, 5).join('\n')}`, 'error');
        return;
    }
    
    if (contacts.length === 0) {
        showToast('Error', 'No valid contacts found', 'error');
        return;
    }
    
    await importContactsData(contacts, 'Manual Input');
};

window.importCSV = async function() {
    const fileInput = document.getElementById('csv-file');
    const file = fileInput?.files[0];
    
    if (!file) {
        showToast('Error', 'Please select a CSV file', 'error');
        return;
    }
    
    try {
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim().length > 0);
        
        if (lines.length < 2) {
            showToast('Error', 'CSV file must have at least a header and one data row', 'error');
            return;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const nameIndex = headers.findIndex(h => h.includes('name'));
        const phoneIndex = headers.findIndex(h => h.includes('phone'));
        const groupIndex = headers.findIndex(h => h.includes('group'));
        const notesIndex = headers.findIndex(h => h.includes('notes'));
        
        if (nameIndex === -1 || phoneIndex === -1) {
            showToast('Error', 'CSV must have Name and Phone columns', 'error');
            return;
        }
        
        const contacts = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
            
            if (values.length > nameIndex && values.length > phoneIndex) {
                contacts.push({
                    name: values[nameIndex],
                    phone: values[phoneIndex],
                    group: groupIndex >= 0 ? values[groupIndex] : null,
                    notes: notesIndex >= 0 ? values[notesIndex] : null
                });
            }
        }
        
        if (contacts.length === 0) {
            showToast('Error', 'No valid contacts found in CSV', 'error');
            return;
        }
        
        await importContactsData(contacts, 'CSV Upload');
    } catch (error) {
        console.error('CSV import error:', error);
        showToast('Error', 'Error reading CSV file', 'error');
    }
};

window.importJSON = async function() {
    const jsonInput = document.getElementById('json-input')?.value.trim();
    
    if (!jsonInput) {
        showToast('Error', 'Please enter JSON data', 'error');
        return;
    }
    
    try {
        const contacts = JSON.parse(jsonInput);
        
        if (!Array.isArray(contacts)) {
            showToast('Error', 'JSON must be an array of contacts', 'error');
            return;
        }
        
        if (contacts.length === 0) {
            showToast('Error', 'JSON array is empty', 'error');
            return;
        }
        
        // Validate JSON structure
        const invalidContacts = contacts.filter(contact => !contact.name || !contact.phone);
        if (invalidContacts.length > 0) {
            showToast('Error', 'All contacts must have name and phone fields', 'error');
            return;
        }
        
        await importContactsData(contacts, 'JSON Import');
    } catch (error) {
        console.error('JSON import error:', error);
        showToast('Error', 'Invalid JSON format', 'error');
    }
};

async function importContactsData(contacts, method) {
    console.log(`Importing ${contacts.length} contacts via ${method}`);
    
    try {
        const response = await fetch('/api/import-contacts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contacts })
        });
        
        const result = await response.json();
        console.log('Import result:', result);
        
        if (result.success) {
            showToast('Success', `Successfully imported ${result.imported} contacts!`, 'success');
            
            // Show import results
            showImportResults(result);
            
            // Clear forms
            document.getElementById('contacts-input').value = '';
            document.getElementById('json-input').value = '';
            document.getElementById('csv-file').value = '';
            
            // Reload contacts
            loadContacts();
        } else {
            showToast('Error', result.error || 'Failed to import contacts', 'error');
            
            if (result.invalidContacts) {
                showImportResults(result);
            }
        }
    } catch (error) {
        console.error('Import contacts error:', error);
        showToast('Error', `Network error: ${error.message}`, 'error');
    }
}

function showImportResults(result) {
    const resultsDiv = document.getElementById('import-results');
    const resultsContent = document.getElementById('import-results-content');
    
    if (resultsDiv && resultsContent) {
        let html = '';
        
        if (result.success && result.imported > 0) {
            html += `<div class="alert alert-success">
                <h6><i class="fas fa-check-circle"></i> Success</h6>
                <p>Successfully imported <strong>${result.imported}</strong> contacts</p>
            </div>`;
        }
        
        if (result.failed > 0 && result.failedContacts) {
            html += `<div class="alert alert-warning">
                <h6><i class="fas fa-exclamation-triangle"></i> Warnings</h6>
                <p><strong>${result.failed}</strong> contacts failed to import:</p>
                <ul>`;
            
            result.failedContacts.slice(0, 10).forEach(failed => {
                html += `<li>${failed.contact.name || 'Unknown'} (${failed.contact.phone || 'No phone'}): ${failed.error}</li>`;
            });
            
            if (result.failedContacts.length > 10) {
                html += `<li>... and ${result.failedContacts.length - 10} more errors</li>`;
            }
            
            html += '</ul></div>';
        }
        
        if (result.invalidContacts) {
            html += `<div class="alert alert-danger">
                <h6><i class="fas fa-times-circle"></i> Validation Errors</h6>
                <ul>`;
            
            result.invalidContacts.forEach(invalid => {
                html += `<li>Contact ${invalid.index}: ${invalid.errors.join(', ')}</li>`;
            });
            
            html += '</ul></div>';
        }
        
        resultsContent.innerHTML = html;
        resultsDiv.style.display = 'block';
        
        // Auto-hide after 10 seconds if successful
        if (result.success && result.failed === 0) {
            setTimeout(() => {
                resultsDiv.style.display = 'none';
            }, 10000);
        }
    }
}