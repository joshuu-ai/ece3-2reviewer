// ==========================================
// QUESTION BUILDER LOGIC
// ==========================================
let builderQuestions = [];
let builderType = 'single';
let builderImageVisible = false;

async function initBuilderScreen() {
    switchBuilderTab('build');
    updateChoiceInputs();
    await populateBuilderSubjects();
}

async function populateBuilderSubjects() {
    const subjSelect = document.getElementById('b-subject');
    const importSelect = document.getElementById('import-subject');
    
    subjSelect.innerHTML = '<option value="" disabled selected>-- Select Subject --</option>';
    if(importSelect) importSelect.innerHTML = '<option value="" disabled selected>-- Select Subject --</option>';
    
    try {
        const snapshot = await db.collection('subjects').get();
        snapshot.forEach(doc => {
            const html = `<option value="${doc.id}">${doc.data().name} (${doc.id})</option>`;
            subjSelect.innerHTML += html;
            if(importSelect) importSelect.innerHTML += html;
        });
    } catch(e) { console.error(e); }
    
    subjSelect.innerHTML += '<option value="ADD_NEW" class="text-violet-400 font-bold">+ Add New Subject</option>';
    if(importSelect) importSelect.innerHTML += '<option value="ADD_NEW" class="text-violet-400 font-bold">+ Add New Subject</option>';
}

function handleImportSubjectChange() {
    const val = document.getElementById('import-subject').value;
    const newGroup = document.getElementById('import-new-subject-group');
    if (val === 'ADD_NEW') {
        newGroup.classList.remove('hidden');
        newGroup.classList.add('animate-slide-down');
    } else {
        newGroup.classList.add('hidden');
    }
}

async function handleBuilderSubjectChange() {
    const val = document.getElementById('b-subject').value;
    const newGroup = document.getElementById('b-new-subject-group');
    const lessonSelect = document.getElementById('b-lesson');
    const delSubjBtn = document.getElementById('btn-del-subj');
    
    document.getElementById('btn-del-lesson').classList.add('hidden');
    
    if (val === 'ADD_NEW') {
        newGroup.classList.remove('hidden');
        newGroup.classList.add('animate-slide-down');
        lessonSelect.innerHTML = '<option value="ADD_NEW" class="text-violet-400 font-bold">+ Add New Lesson</option>';
        lessonSelect.disabled = false;
        delSubjBtn.classList.add('hidden');
        handleBuilderLessonChange();
        return;
    }
    
    newGroup.classList.add('hidden');
    delSubjBtn.classList.remove('hidden');
    lessonSelect.disabled = false;
    lessonSelect.innerHTML = '<option value="" disabled selected>Loading lessons...</option>';
    
    const lessons = new Set();
    
    // DB lessons
    try {
        const snapshot = await db.collection('subjects').doc(val).collection('questions').get();
        snapshot.forEach(doc => lessons.add(doc.data().topic));
    } catch(e){}
    
    lessonSelect.innerHTML = '<option value="" disabled selected>-- Select Lesson --</option>';
    lessons.forEach(l => {
        lessonSelect.innerHTML += `<option value="${l}">${l}</option>`;
    });
    lessonSelect.innerHTML += '<option value="ADD_NEW" class="text-violet-400 font-bold">+ Add New Lesson</option>';
    handleBuilderLessonChange();
}

function handleBuilderLessonChange() {
    const val = document.getElementById('b-lesson').value;
    const newGroup = document.getElementById('b-new-lesson-group');
    const delLessonBtn = document.getElementById('btn-del-lesson');
    
    if (val === 'ADD_NEW') {
        newGroup.classList.remove('hidden');
        newGroup.classList.add('animate-slide-down');
        delLessonBtn.classList.add('hidden');
    } else {
        newGroup.classList.add('hidden');
        if(val) delLessonBtn.classList.remove('hidden');
    }
}


function switchBuilderTab(tab) {
    ['build','import','preview'].forEach(t => {
        document.getElementById('tab-' + t).classList.add('hidden');
        const btn = document.getElementById('tab-' + t + '-btn');
        btn.className = 'flex-1 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest text-slate-500 hover:text-white border-b-2 border-transparent transition-colors';
    });
    document.getElementById('tab-' + tab).classList.remove('hidden');
    const activeBtn = document.getElementById('tab-' + tab + '-btn');
    activeBtn.className = 'flex-1 py-3 text-xs sm:text-sm font-bold uppercase tracking-widest text-violet-400 border-b-2 border-violet-500 transition-colors';
    if (tab === 'preview') renderBuilderPreview();
}

function toggleBuilderImage() {
    builderImageVisible = !builderImageVisible;
    document.getElementById('b-img-box').classList.toggle('hidden', !builderImageVisible);
    const btn = document.getElementById('b-img-toggle');
    btn.className = builderImageVisible
        ? 'flex items-center gap-2 bg-violet-700 border border-violet-500 text-violet-200 font-bold text-xs uppercase tracking-widest py-2 px-4 rounded-lg transition-colors'
        : 'flex items-center gap-2 bg-slate-800 border border-slate-700 hover:border-violet-500 text-slate-400 hover:text-violet-400 font-bold text-xs uppercase tracking-widest py-2 px-4 rounded-lg transition-colors';
}

function setBuilderType(type) {
    builderType = type;
    document.getElementById('b-type-single').className = type === 'single'
        ? 'flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-violet-600 text-white border border-violet-500'
        : 'flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700';
    document.getElementById('b-type-multiple').className = type === 'multiple'
        ? 'flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-violet-600 text-white border border-violet-500'
        : 'flex-1 py-2 rounded-lg font-bold text-xs uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700';
    document.getElementById('b-multi-hint').classList.toggle('hidden', type !== 'multiple');
    updateChoiceInputs();
}

function updateChoiceInputs() {
    const num = parseInt(document.getElementById('b-num-choices').value);
    document.getElementById('b-num-label').innerText = num;
    const container = document.getElementById('b-choices-container');
    const existing = Array.from(container.querySelectorAll('input[type="text"]')).map(i => i.value);
    const existingChecked = Array.from(container.querySelectorAll('input[type="checkbox"]')).map(i => i.checked);
    container.innerHTML = '';
    const letters = ['A','B','C','D','E','F'];
    for (let i = 0; i < num; i++) {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-2';
        if (builderType === 'single') {
            row.innerHTML = `
                <input type="radio" name="b-correct" value="${i}" id="b-radio-${i}" class="accent-violet-500 w-4 h-4 shrink-0" ${i === 0 && !existingChecked.some(Boolean) ? 'checked' : (existingChecked[i] ? 'checked' : '')}>
                <label for="b-radio-${i}" class="text-xs text-slate-400 font-bold w-5 shrink-0">${letters[i]}</label>
                <input type="text" id="b-choice-${i}" placeholder="Choice ${letters[i]}" value="${existing[i]||''}" class="flex-1 bg-slate-800 text-white border border-slate-700 rounded-lg py-1.5 px-3 focus:outline-none focus:border-violet-500 text-sm transition-colors">
            `;
        } else {
            row.innerHTML = `
                <input type="checkbox" id="b-chk-${i}" class="accent-violet-500 w-4 h-4 shrink-0" ${existingChecked[i] ? 'checked' : ''}>
                <label for="b-chk-${i}" class="text-xs text-slate-400 font-bold w-5 shrink-0">${letters[i]}</label>
                <input type="text" id="b-choice-${i}" placeholder="Choice ${letters[i]}" value="${existing[i]||''}" class="flex-1 bg-slate-800 text-white border border-slate-700 rounded-lg py-1.5 px-3 focus:outline-none focus:border-violet-500 text-sm transition-colors">
            `;
        }
        container.appendChild(row);
    }
}

function addBuilderQuestion() {
    const subjVal = document.getElementById('b-subject').value;
    const lessonVal = document.getElementById('b-lesson').value;
    
    let subjectId = subjVal;
    let subjectName = "";
    let topic = lessonVal;
    
    if (!subjVal) { showBuilderToast('Please select a Subject.', false); return; }
    if (subjVal === 'ADD_NEW') {
        subjectId = document.getElementById('b-new-subj-id').value.trim().toUpperCase();
        subjectName = document.getElementById('b-new-subj-name').value.trim();
        if (!subjectId || !subjectName) { showBuilderToast('Please fill out the new subject fields.', false); return; }
    } else {
        const selectEl = document.getElementById('b-subject');
        subjectName = selectEl.options[selectEl.selectedIndex].text.split(' (')[0];
    }
    
    if (!lessonVal) { showBuilderToast('Please select a Lesson.', false); return; }
    if (lessonVal === 'ADD_NEW') {
        topic = document.getElementById('b-new-lesson-name').value.trim();
        if (!topic) { showBuilderToast('Please enter a new lesson title.', false); return; }
    }

    const question = document.getElementById('b-question').value.trim();
    const explanation = document.getElementById('b-explanation').value.trim();
    const image = builderImageVisible ? document.getElementById('b-image').value.trim() : '';
    const num = parseInt(document.getElementById('b-num-choices').value);

    if (!question) { showBuilderToast('Please enter a question.', false); return; }

    const choices = [];
    for (let i = 0; i < num; i++) {
        const v = document.getElementById('b-choice-' + i).value.trim();
        if (!v) { showBuilderToast(`Choice ${String.fromCharCode(65+i)} is empty.`, false); return; }
        choices.push(v);
    }

    let correctAnswer;
    if (builderType === 'single') {
        const sel = document.querySelector('input[name="b-correct"]:checked');
        if (!sel) { showBuilderToast('Please select the correct answer.', false); return; }
        correctAnswer = choices[parseInt(sel.value)];
    } else {
        const checked = [];
        for (let i = 0; i < num; i++) {
            if (document.getElementById('b-chk-' + i).checked) checked.push(choices[i]);
        }
        if (checked.length === 0) { showBuilderToast('Select at least one correct answer.', false); return; }
        correctAnswer = checked;
    }

    builderQuestions.push({ subjectId, subjectName, topic, type: builderType, image, question, choices, correctAnswer, explanation });
    playSound('complete');
    showBuilderToast(`✓ Question #${builderQuestions.length} added!`, true);
    clearBuilderForm(true);
}

function clearBuilderForm(keepTopic = false) {
    if (!keepTopic) {
        document.getElementById('b-subject').value = '';
        document.getElementById('import-subject').value = '';
        document.getElementById('b-lesson').value = '';
        document.getElementById('b-lesson').disabled = true;
        document.getElementById('b-new-subject-group').classList.add('hidden');
        document.getElementById('import-new-subject-group').classList.add('hidden');
        document.getElementById('b-new-lesson-group').classList.add('hidden');
    }
    document.getElementById('b-question').value = '';
    document.getElementById('b-explanation').value = '';
    if (builderImageVisible) toggleBuilderImage();
    const imgEl = document.getElementById('b-image');
    if (imgEl) imgEl.value = '';
    document.getElementById('b-num-choices').value = 4;
    updateChoiceInputs();
}

function showBuilderToast(msg, success) {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] px-6 py-3 rounded-xl font-bold text-sm shadow-xl border transition-all ${success ? 'bg-emerald-900 border-emerald-500 text-emerald-300' : 'bg-rose-900 border-rose-500 text-rose-300'}`;
    toast.innerText = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function renderBuilderPreview() {
    const list = document.getElementById('preview-list');
    const empty = document.getElementById('preview-empty');
    const actions = document.getElementById('preview-actions');
    list.innerHTML = '';
    if (builderQuestions.length === 0) {
        empty.classList.remove('hidden');
        actions.classList.add('hidden');
        return;
    }
    empty.classList.add('hidden');
    actions.classList.remove('hidden');

    const grouped = {};
    builderQuestions.forEach((q, idx) => {
        if (!grouped[q.topic]) grouped[q.topic] = [];
        grouped[q.topic].push({...q, _idx: idx});
    });

    Object.entries(grouped).forEach(([topic, qs]) => {
        const topicDiv = document.createElement('div');
        topicDiv.className = 'bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3';
        topicDiv.innerHTML = `<h4 class="text-violet-400 font-bold uppercase tracking-widest text-xs mb-3"><i class="fa-solid fa-folder-open mr-2"></i>${topic} <span class="text-slate-500">(${qs.length} question${qs.length>1?'s':''})</span></h4>`;

        qs.forEach(q => {
            const card = document.createElement('div');
            card.className = 'bg-slate-950 border border-slate-800 rounded-xl p-4';
            const typeBadge = q.type === 'multiple'
                ? `<span class="text-blue-400 bg-blue-900/30 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Multi</span>`
                : `<span class="text-emerald-400 bg-emerald-900/30 border border-emerald-500/30 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Single</span>`;
            card.innerHTML = `
                <div class="flex items-start justify-between gap-2 mb-2">
                    <p class="text-slate-200 text-sm font-semibold flex-1">${q.question}</p>
                    <div class="flex gap-2 items-center shrink-0">
                        ${typeBadge}
                        <button onclick="removeBuilderQuestion(${q._idx})" class="text-rose-500 hover:text-rose-300 text-xs ml-1"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
                ${q.image ? `<img src="${q.image}" class="w-full max-h-40 object-contain rounded-lg mb-2 bg-slate-800">` : ''}
                <div class="flex flex-wrap gap-1 mb-2">
                    ${q.choices.map(c => `<span class="px-2 py-0.5 rounded text-xs font-bold border ${(Array.isArray(q.correctAnswer)?q.correctAnswer.includes(c):q.correctAnswer===c) ? 'bg-emerald-900/40 border-emerald-500 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}">${c}</span>`).join('')}
                </div>
                ${q.explanation ? `<p class="text-slate-500 text-xs italic"><i class="fa-solid fa-terminal mr-1 text-cyan-600"></i>${q.explanation}</p>` : ''}
            `;
            topicDiv.appendChild(card);
        });
        list.appendChild(topicDiv);
    });
}

function removeBuilderQuestion(idx) {
    builderQuestions.splice(idx, 1);
    renderBuilderPreview();
}

function clearAllBuilderQuestions() {
    if (!confirm('Delete all questions in the builder?')) return;
    builderQuestions = [];
    renderBuilderPreview();
}

function exportBuilderJSON() {
    const grouped = {};
    builderQuestions.forEach(q => {
        if (!grouped[q.topic]) grouped[q.topic] = { topic: q.topic, reviewerFacts: [], questions: [] };
        grouped[q.topic].questions.push({
            type: q.type,
            image: q.image || '',
            question: q.question,
            choices: q.choices,
            correctAnswer: q.correctAnswer,
            explanation: q.explanation || ''
        });
    });
    const output = Object.values(grouped);
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `questions_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showBuilderToast('JSON exported!', true);
}

async function saveBuilderToDatabase() {
    if (builderQuestions.length === 0) return;
    const btn = document.getElementById('btn-save-db');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
    
    try {
        let added = 0;
        for (const q of builderQuestions) {
            // Ensure subject document exists
            await db.collection('subjects').doc(q.subjectId).set({
                name: q.subjectName || q.subjectId,
                icon: 'fa-folder',
                color: 'from-violet-500 to-fuchsia-500'
            }, { merge: true });
            
            // Add question
            await db.collection('subjects').doc(q.subjectId).collection('questions').add({
                topic: q.topic,
                type: q.type,
                image: q.image || '',
                question: q.question,
                choices: q.choices,
                correctAnswer: q.correctAnswer,
                explanation: q.explanation || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            added++;
        }
        showBuilderToast(`✓ Successfully saved ${added} questions to DB!`, true);
        playSound('complete');
        builderQuestions = [];
        renderBuilderPreview();
        populateBuilderSubjects(); // Refresh dropdown
        clearBuilderForm(false); // Reset hidden fields and selections
        if (typeof renderSubjectButtons === 'function') renderSubjectButtons(); // Refresh dashboard UI
    } catch(err) {
        showBuilderToast('Error saving to Database.', false);
        console.error(err);
    }
    
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up text-xl"></i> Save to Database';
}

// Image Compression to Base64 (Bypasses Firebase Storage entirely!)
function compressImageToBase64(file, maxWidth = 800, maxHeight = 800, quality = 0.6) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                if (width > maxWidth || height > maxHeight) {
                    if (width / height > maxWidth / maxHeight) {
                        height = Math.round((maxWidth / width) * height);
                        width = maxWidth;
                    } else {
                        width = Math.round((maxHeight / height) * width);
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert directly to Base64 text!
                const base64String = canvas.toDataURL('image/jpeg', quality);
                resolve(base64String);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}

async function handleBuilderImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const statusEl = document.getElementById('b-image-status');
    const inputEl = document.getElementById('b-image');
    
    statusEl.classList.remove('hidden');
    inputEl.disabled = true;
    
    try {
        statusEl.innerText = "COMPRESSING & SAVING LOCALLY...";
        
        // This compresses the image and turns it into text
        const base64Data = await compressImageToBase64(file);
        
        // Put the long text directly into the image box
        inputEl.value = base64Data;
        showBuilderToast('Image processed without Firebase Storage!', true);
    } catch(err) {
        showBuilderToast('Image processing failed.', false);
        console.error(err);
    }
    
    statusEl.classList.add('hidden');
    inputEl.disabled = false;
    event.target.value = ''; // reset input
}

// ---- JSON IMPORT ----
function handleFileDrop(e) {
    e.preventDefault();
    document.getElementById('drop-zone').classList.remove('border-violet-400');
    const file = e.dataTransfer.files[0];
    if (file) readJSONFile(file);
}

function handleFileInput(e) {
    const file = e.target.files[0];
    if (file) readJSONFile(file);
}

function readJSONFile(file) {
    if (!file.name.endsWith('.json')) { showImportStatus('Only .json files are supported.', false); return; }
    const reader = new FileReader();
    reader.onload = e => processImportedJSON(e.target.result);
    reader.readAsText(file);
}

function importFromPaste() {
    const raw = document.getElementById('json-paste-area').value.trim();
    if (!raw) { showImportStatus('Paste your JSON first.', false); return; }
    processImportedJSON(raw);
}

function processImportedJSON(raw) {
    let importSubjVal = document.getElementById('import-subject').value;
    let subjectName = '';

    if (!importSubjVal) {
        showImportStatus('Please select a Subject first.', false);
        return;
    }

    if (importSubjVal === 'ADD_NEW') {
        importSubjVal = document.getElementById('import-new-subj-id').value.trim().toUpperCase();
        subjectName = document.getElementById('import-new-subj-name').value.trim();
        if (!importSubjVal || !subjectName) {
            showImportStatus('Please fill out the new subject fields.', false);
            return;
        }
    } else {
        const selectEl = document.getElementById('import-subject');
        subjectName = selectEl.options[selectEl.selectedIndex].text.split(' (')[0];
    }

    try {
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) throw new Error('Root must be an array.');
        let added = 0;
        data.forEach(topicObj => {
            const topic = topicObj.topic || 'Untitled Topic';
            (topicObj.questions || []).forEach(q => {
                builderQuestions.push({
                    subjectId: importSubjVal,
                    subjectName: subjectName,
                    topic,
                    type: q.type || 'single',
                    image: q.image || '',
                    question: q.question || '',
                    choices: q.choices || [],
                    correctAnswer: q.correctAnswer,
                    explanation: q.explanation || ''
                });
                added++;
            });
        });
        showImportStatus(`✓ Imported ${added} question${added!==1?'s':''} from ${data.length} topic${data.length!==1?'s':''}!`, true);
        setTimeout(() => { switchBuilderTab('preview'); }, 1200);
    } catch(err) {
        showImportStatus('Invalid JSON: ' + err.message, false);
    }
}

function copyAIPrompt() {
    const text = document.getElementById('ai-prompt-text').value;
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.getElementById('btn-copy-ai');
        const oldHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check mr-1"></i>Copied!';
        btn.classList.add('bg-emerald-600', 'border-emerald-500', 'text-white');
        btn.classList.remove('bg-slate-800', 'border-slate-700', 'text-slate-400');
        setTimeout(() => {
            btn.innerHTML = oldHtml;
            btn.classList.remove('bg-emerald-600', 'border-emerald-500', 'text-white');
            btn.classList.add('bg-slate-800', 'border-slate-700', 'text-slate-400');
        }, 2000);
    }).catch(err => console.error('Failed to copy text: ', err));
}

function showImportStatus(msg, success) {
    const el = document.getElementById('import-status');
    el.innerText = msg;
    el.className = `rounded-xl p-4 text-sm font-bold text-center ${success ? 'bg-emerald-900/40 border border-emerald-500 text-emerald-300' : 'bg-rose-900/40 border border-rose-500 text-rose-300'}`;
    el.classList.remove('hidden');
}

// ==========================================
// DELETION VERIFICATION LOGIC
// ==========================================
let itemToDelete = null; // { type: 'subject' | 'lesson', subjectId, lessonName }

function promptDeleteSubject() {
    const subjVal = document.getElementById('b-subject').value;
    if (!subjVal || subjVal === 'ADD_NEW') return;
    
    itemToDelete = { type: 'subject', subjectId: subjVal };
    document.getElementById('delete-verify-msg').innerHTML = `You are about to delete the subject <strong class="text-rose-400">${subjVal}</strong>.<br><br>This will permanently delete <strong>ALL</strong> lessons and questions inside it.`;
    document.getElementById('delete-verify-input').value = '';
    document.getElementById('btn-confirm-final-delete').disabled = true;
    document.getElementById('btn-confirm-final-delete').classList.add('opacity-50', 'cursor-not-allowed');
    document.getElementById('delete-verify-modal').classList.remove('hidden');
}

function promptDeleteLesson() {
    const subjVal = document.getElementById('b-subject').value;
    const lessonVal = document.getElementById('b-lesson').value;
    if (!subjVal || !lessonVal || lessonVal === 'ADD_NEW') return;
    
    itemToDelete = { type: 'lesson', subjectId: subjVal, lessonName: lessonVal };
    document.getElementById('delete-verify-msg').innerHTML = `You are about to delete the lesson <strong class="text-rose-400">${lessonVal}</strong> from <strong class="text-rose-400">${subjVal}</strong>.<br><br>This will permanently delete all questions inside this lesson.`;
    document.getElementById('delete-verify-input').value = '';
    document.getElementById('btn-confirm-final-delete').disabled = true;
    document.getElementById('btn-confirm-final-delete').classList.add('opacity-50', 'cursor-not-allowed');
    document.getElementById('delete-verify-modal').classList.remove('hidden');
}

function closeDeleteVerifyModal() {
    document.getElementById('delete-verify-modal').classList.add('hidden');
    itemToDelete = null;
}

function checkDeleteVerifyInput() {
    const input = document.getElementById('delete-verify-input').value;
    const btn = document.getElementById('btn-confirm-final-delete');
    if (input === '1234') {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}

async function executeFinalDelete() {
    if (!itemToDelete) return;
    const btn = document.getElementById('btn-confirm-final-delete');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
    
    try {
        if (itemToDelete.type === 'lesson') {
            // Delete all questions with this topic
            const snapshot = await db.collection('subjects').doc(itemToDelete.subjectId).collection('questions').where('topic', '==', itemToDelete.lessonName).get();
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            showBuilderToast(`Lesson '${itemToDelete.lessonName}' deleted.`, true);
        } else if (itemToDelete.type === 'subject') {
            // Delete all questions in the subject
            const snapshot = await db.collection('subjects').doc(itemToDelete.subjectId).collection('questions').get();
            const batch = db.batch();
            snapshot.forEach(doc => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            // Delete the subject document itself
            await db.collection('subjects').doc(itemToDelete.subjectId).delete();
            showBuilderToast(`Subject '${itemToDelete.subjectId}' deleted.`, true);
        }
        
        closeDeleteVerifyModal();
        populateBuilderSubjects(); // Refresh UI
        clearBuilderForm(false);
        renderSubjectButtons(); // Refresh Dashboard UI
    } catch(err) {
        console.error(err);
        showBuilderToast('Error deleting data.', false);
        btn.disabled = false;
        btn.innerHTML = 'Delete';
    }
}
