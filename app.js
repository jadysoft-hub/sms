// 🔐 Kendi JSONBin bilgilerinizi buraya yazın (ÖNEMLİ)
const API_KEY = " $2a$10$JGOBHlKcxZkUbNs5cdk94.hBGlx6vtDMYI5uf0iAzSWlqSlS.J8UW ";    // Örn: $2a$10$xxxxx
const BIN_ID = null; // Başlangıçta null, kullanıcı girecek

let currentBinId = null;
let pollingInterval = null;
let lastMessageCount = 0;

// DOM elemanları
const roomPanel = document.getElementById('roomPanel');
const chatPanel = document.getElementById('chatPanel');
const binIdInput = document.getElementById('binIdInput');
const joinBtn = document.getElementById('joinBtn');
const leaveBtn = document.getElementById('leaveBtn');
const binIdDisplay = document.getElementById('binIdDisplay');
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');

// JSONBin'den mesajları oku
async function fetchMessages() {
    if (!currentBinId) return [];
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${currentBinId}/latest`, {
            headers: {
                'X-Master-Key': API_KEY
            }
        });
        const data = await response.json();
        return data.record.messages || [];
    } catch (error) {
        console.error("Okuma hatası:", error);
        return [];
    }
}

// JSONBin'e mesajları kaydet
async function saveMessages(messages) {
    if (!currentBinId) return false;
    try {
        const response = await fetch(`https://api.jsonbin.io/v3/b/${currentBinId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Master-Key': API_KEY
            },
            body: JSON.stringify({ messages: messages })
        });
        return response.ok;
    } catch (error) {
        console.error("Yazma hatası:", error);
        return false;
    }
}

// Yeni mesaj gönder
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentBinId) return;

    const currentMessages = await fetchMessages();
    const newMessage = {
        text: text,
        timestamp: Date.now()
    };
    currentMessages.push(newMessage);
    const success = await saveMessages(currentMessages);
    if (success) {
        messageInput.value = '';
        // Hemen UI'a ekle (polling'i beklemeden)
        addMessageToUI(newMessage.text, newMessage.timestamp);
        // Polling'i hemen tetikle
        await pollMessages();
    } else {
        alert("Mesaj gönderilemedi!");
    }
}

// UI'a mesaj ekle
function addMessageToUI(text, timestamp) {
    const div = document.createElement('div');
    div.className = 'message';
    const timeStr = new Date(timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
    div.innerHTML = `<span class="msg-text">${escapeHtml(text)}</span><span class="msg-time">${timeStr}</span>`;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// HTML escape (XSS koruması)
function escapeHtml(str) {
    return str.replace(/[&<>]/g, function(m) {
        if(m === '&') return '&amp;';
        if(m === '<') return '&lt;';
        if(m === '>') return '&gt;';
        return m;
    });
}

// Polling: Yeni mesaj var mı kontrol et
async function pollMessages() {
    if (!currentBinId) return;
    const messages = await fetchMessages();
    if (messages.length > lastMessageCount) {
        // Sadece yeni mesajları ekle
        for (let i = lastMessageCount; i < messages.length; i++) {
            addMessageToUI(messages[i].text, messages[i].timestamp);
        }
        lastMessageCount = messages.length;
    }
}

// Odaya katıl
async function joinRoom() {
    const binId = binIdInput.value.trim();
    if (!binId) {
        alert("Lütfen bir Bin ID girin!");
        return;
    }
    // Bin ID geçerli mi kontrol et
    try {
        const test = await fetch(`https://api.jsonbin.io/v3/b/${binId}/latest`, {
            headers: { 'X-Master-Key': API_KEY }
        });
        if (!test.ok) throw new Error("Bin bulunamadı");
        const data = await test.json();
        if (!data.record.messages) {
            // Eğer mesaj dizisi yoksa oluştur
            await saveMessages([]);
        }
    } catch (e) {
        alert("Geçersiz Bin ID veya API hatası. Lütfen kontrol edin.");
        return;
    }

    currentBinId = binId;
    lastMessageCount = 0;
    messagesDiv.innerHTML = ''; // Temizle
    binIdDisplay.innerText = currentBinId;
    
    // İlk mesajları yükle
    const messages = await fetchMessages();
    lastMessageCount = messages.length;
    messages.forEach(msg => addMessageToUI(msg.text, msg.timestamp));
    
    // Polling başlat (2 saniyede bir)
    if (pollingInterval) clearInterval(pollingInterval);
    pollingInterval = setInterval(pollMessages, 2000);
    
    roomPanel.style.display = 'none';
    chatPanel.style.display = 'flex';
    messageInput.focus();
}

// Odadan çık
function leaveRoom() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
    currentBinId = null;
    lastMessageCount = 0;
    roomPanel.style.display = 'flex';
    chatPanel.style.display = 'none';
    binIdInput.value = '';
    messagesDiv.innerHTML = '';
}

// Olay dinleyiciler
joinBtn.addEventListener('click', joinRoom);
sendBtn.addEventListener('click', sendMessage);
leaveBtn.addEventListener('click', leaveRoom);
messageInput.addEventListener('keypress', (e) => {
    if(e.key === 'Enter') sendMessage();
});
