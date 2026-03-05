/* ============================================
   PRISMA - Gerenciamento de Dados (Firebase)
   Carrega tudo na memoria e sincroniza com Firestore
   ============================================ */

const DB = {
    // Dados em memoria (cache local)
    _cache: {
        users: [],
        patients: [],
        evolutions: [],
        reports: [],
        abaTargets: [],
        abaSessions: []
    },

    _ready: false,
    _onReadyCallbacks: [],

    // ====== INICIALIZACAO ======
    async init() {
        try {
            await this._loadAll();
            await this._ensureDefaults();
            this._ready = true;
            this._onReadyCallbacks.forEach(cb => cb());
        } catch (err) {
            console.error('Erro ao conectar com Firebase:', err);
            // Fallback: usar localStorage
            this._useFallback();
            this._ready = true;
            this._onReadyCallbacks.forEach(cb => cb());
        }
    },

    onReady(callback) {
        if (this._ready) {
            callback();
        } else {
            this._onReadyCallbacks.push(callback);
        }
    },

    async _loadAll() {
        const [usersSnap, patientsSnap, evosSnap, repsSnap, targetsSnap, sessionsSnap] = await Promise.all([
            db.collection('users').get(),
            db.collection('patients').get(),
            db.collection('evolutions').get(),
            db.collection('reports').get(),
            db.collection('abaTargets').get(),
            db.collection('abaSessions').get()
        ]);

        this._cache.users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.patients = patientsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.evolutions = evosSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.reports = repsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.abaTargets = targetsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        this._cache.abaSessions = sessionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async _ensureDefaults() {
        if (this._cache.users.length === 0) {
            const defaultUsers = [
                {
                    id: 'coord1',
                    name: 'Coordenacao Prisma',
                    username: 'coordenacao',
                    password: 'prisma2025',
                    role: 'coordenacao',
                    specialty: 'Coordenacao Geral'
                },
                {
                    id: 'ter1',
                    name: 'Suelene Cibelle Silva dos Reis',
                    username: 'suelene.reis',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Fonoaudiologa'
                },
                {
                    id: 'ter2',
                    name: 'Kadyja',
                    username: 'kadyja',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Psicologa ABA'
                },
                {
                    id: 'ter3',
                    name: 'Erika Siqueira Machado',
                    username: 'erika.machado',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Terapeuta Ocupacional / Psicopedagoga'
                },
                {
                    id: 'ter4',
                    name: 'Wescley Guilherme da Mota',
                    username: 'wescley.mota',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Terapeuta Ocupacional IS'
                },
                {
                    id: 'ter5',
                    name: 'Wilaine',
                    username: 'wilaine',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Psicomotricista'
                },
                {
                    id: 'ter6',
                    name: 'Wanessa',
                    username: 'wanessa',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Psicologa'
                },
                {
                    id: 'ter7',
                    name: 'Julio',
                    username: 'julio',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Terapeuta'
                }
            ];

            const batch = db.batch();
            for (const user of defaultUsers) {
                const ref = db.collection('users').doc(user.id);
                batch.set(ref, user);
            }
            await batch.commit();
            this._cache.users = [...defaultUsers];
        }
    },

    _useFallback() {
        // Se Firebase falhar, usa localStorage como backup
        console.warn('Usando localStorage como fallback');
        const lsUsers = JSON.parse(localStorage.getItem('prisma_users') || '[]');
        if (lsUsers.length > 0) {
            this._cache.users = lsUsers;
        } else {
            this._cache.users = [
                { id: 'coord1', name: 'Coordenacao Prisma', username: 'coordenacao', password: 'prisma2025', role: 'coordenacao', specialty: 'Coordenacao Geral' },
                { id: 'ter1', name: 'Suelene Cibelle Silva dos Reis', username: 'suelene.reis', password: 'prisma123', role: 'terapeuta', specialty: 'Fonoaudiologa' },
                { id: 'ter2', name: 'Kadyja', username: 'kadyja', password: 'prisma123', role: 'terapeuta', specialty: 'Psicologa ABA' },
                { id: 'ter3', name: 'Erika Siqueira Machado', username: 'erika.machado', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta Ocupacional / Psicopedagoga' },
                { id: 'ter4', name: 'Wescley Guilherme da Mota', username: 'wescley.mota', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta Ocupacional IS' },
                { id: 'ter5', name: 'Wilaine', username: 'wilaine', password: 'prisma123', role: 'terapeuta', specialty: 'Psicomotricista' },
                { id: 'ter6', name: 'Wanessa', username: 'wanessa', password: 'prisma123', role: 'terapeuta', specialty: 'Psicologa' },
                { id: 'ter7', name: 'Julio', username: 'julio', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta' }
            ];
        }
        this._cache.patients = JSON.parse(localStorage.getItem('prisma_patients') || '[]');
        this._cache.evolutions = JSON.parse(localStorage.getItem('prisma_evolutions') || '[]');
        this._cache.reports = JSON.parse(localStorage.getItem('prisma_reports') || '[]');
        this._cache.abaTargets = JSON.parse(localStorage.getItem('prisma_abaTargets') || '[]');
        this._cache.abaSessions = JSON.parse(localStorage.getItem('prisma_abaSessions') || '[]');
    },

    // ====== USUARIOS ======
    getUsers() {
        return this._cache.users;
    },

    getTherapists() {
        return this._cache.users.filter(u => u.role === 'terapeuta');
    },

    getUserById(id) {
        return this._cache.users.find(u => u.id === id);
    },

    async addUser(user) {
        user.id = 'ter' + Date.now();
        this._cache.users.push(user);
        try {
            await db.collection('users').doc(user.id).set(user);
        } catch (e) { console.error(e); }
        return user;
    },

    async removeUser(id) {
        this._cache.users = this._cache.users.filter(u => u.id !== id);
        try {
            await db.collection('users').doc(id).delete();
        } catch (e) { console.error(e); }
    },

    authenticate(username, password) {
        return this._cache.users.find(u => u.username === username && u.password === password) || null;
    },

    // ====== SESSAO ======
    setCurrentUser(user) {
        const safeUser = { ...user };
        delete safeUser.password;
        sessionStorage.setItem('prisma_current_user', JSON.stringify(safeUser));
    },

    getCurrentUser() {
        const data = sessionStorage.getItem('prisma_current_user');
        return data ? JSON.parse(data) : null;
    },

    logout() {
        sessionStorage.removeItem('prisma_current_user');
    },

    // ====== PACIENTES ======
    getPatients() {
        return this._cache.patients;
    },

    getPatientById(id) {
        return this._cache.patients.find(p => p.id === id);
    },

    getPatientsByTherapist(therapistId) {
        return this._cache.patients.filter(p => p.therapistId === therapistId);
    },

    async addPatient(patient) {
        patient.id = 'pac' + Date.now();
        patient.createdAt = new Date().toISOString();
        this._cache.patients.push(patient);
        try {
            await db.collection('patients').doc(patient.id).set(patient);
        } catch (e) { console.error(e); }
        return patient;
    },

    async updatePatient(id, data) {
        const idx = this._cache.patients.findIndex(p => p.id === id);
        if (idx !== -1) {
            this._cache.patients[idx] = { ...this._cache.patients[idx], ...data };
            try {
                await db.collection('patients').doc(id).update(data);
            } catch (e) { console.error(e); }
        }
    },

    async removePatient(id) {
        this._cache.patients = this._cache.patients.filter(p => p.id !== id);
        this._cache.evolutions = this._cache.evolutions.filter(e => e.patientId !== id);
        try {
            await db.collection('patients').doc(id).delete();
            const evosSnap = await db.collection('evolutions').where('patientId', '==', id).get();
            const batch = db.batch();
            evosSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (e) { console.error(e); }
    },

    // ====== EVOLUCOES ======
    getEvolutions() {
        return this._cache.evolutions;
    },

    getEvolutionsByPatient(patientId) {
        return this._cache.evolutions
            .filter(e => e.patientId === patientId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getEvolutionsByTherapist(therapistId) {
        return this._cache.evolutions
            .filter(e => e.therapistId === therapistId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async addEvolution(evolution) {
        evolution.id = 'evo' + Date.now();
        evolution.createdAt = new Date().toISOString();
        this._cache.evolutions.push(evolution);
        try {
            await db.collection('evolutions').doc(evolution.id).set(evolution);
        } catch (e) { console.error(e); }
        return evolution;
    },

    async updateEvolution(id, data) {
        const idx = this._cache.evolutions.findIndex(e => e.id === id);
        if (idx !== -1) {
            this._cache.evolutions[idx] = { ...this._cache.evolutions[idx], ...data };
            try {
                await db.collection('evolutions').doc(id).update(data);
            } catch (e) { console.error(e); }
        }
    },

    async removeEvolution(id) {
        this._cache.evolutions = this._cache.evolutions.filter(e => e.id !== id);
        try {
            await db.collection('evolutions').doc(id).delete();
        } catch (e) { console.error(e); }
    },

    // ====== RELATORIOS ======
    getReports() {
        return this._cache.reports;
    },

    getReportsByPatient(patientId) {
        return this._cache.reports
            .filter(r => r.patientId === patientId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getReportsByTherapist(therapistId) {
        return this._cache.reports
            .filter(r => r.therapistId === therapistId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async addReport(report) {
        report.id = 'rep' + Date.now();
        report.createdAt = new Date().toISOString();
        this._cache.reports.push(report);
        try {
            await db.collection('reports').doc(report.id).set(report);
        } catch (e) { console.error(e); }
        return report;
    },

    async removeReport(id) {
        this._cache.reports = this._cache.reports.filter(r => r.id !== id);
        try {
            await db.collection('reports').doc(id).delete();
        } catch (e) { console.error(e); }
    },

    async updateReport(id, data) {
        const idx = this._cache.reports.findIndex(r => r.id === id);
        if (idx !== -1) {
            this._cache.reports[idx] = { ...this._cache.reports[idx], ...data };
            try {
                await db.collection('reports').doc(id).update(data);
            } catch (e) { console.error(e); }
        }
    },

    // ====== USUARIOS - TROCA DE SENHA ======
    async changePassword(userId, newPassword) {
        const idx = this._cache.users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            this._cache.users[idx].password = newPassword;
            try {
                await db.collection('users').doc(userId).update({ password: newPassword });
            } catch (e) { console.error(e); }
            return true;
        }
        return false;
    },

    async updateUser(id, data) {
        const idx = this._cache.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            this._cache.users[idx] = { ...this._cache.users[idx], ...data };
            try {
                await db.collection('users').doc(id).update(data);
            } catch (e) { console.error(e); }
        }
    },

    // ====== ABA ALVOS (TARGETS) ======
    getAbaTargets() { return this._cache.abaTargets; },

    getAbaTargetsByPatient(patientId) {
        return this._cache.abaTargets.filter(t => t.patientId === patientId);
    },

    getAbaTargetById(id) {
        return this._cache.abaTargets.find(t => t.id === id);
    },

    async addAbaTarget(target) {
        target.id = 'abt' + Date.now();
        target.createdAt = new Date().toISOString();
        target.status = target.status || 'em_treino';
        this._cache.abaTargets.push(target);
        try { await db.collection('abaTargets').doc(target.id).set(target); } catch (e) { console.error(e); }
        return target;
    },

    async updateAbaTarget(id, data) {
        const idx = this._cache.abaTargets.findIndex(t => t.id === id);
        if (idx !== -1) {
            this._cache.abaTargets[idx] = { ...this._cache.abaTargets[idx], ...data };
            try { await db.collection('abaTargets').doc(id).update(data); } catch (e) { console.error(e); }
        }
    },

    async removeAbaTarget(id) {
        this._cache.abaTargets = this._cache.abaTargets.filter(t => t.id !== id);
        this._cache.abaSessions = this._cache.abaSessions.filter(s => s.targetId !== id);
        try {
            await db.collection('abaTargets').doc(id).delete();
            const snap = await db.collection('abaSessions').where('targetId', '==', id).get();
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (e) { console.error(e); }
    },

    // ====== ABA SESSOES (SESSION DATA) ======
    getAbaSessions() { return this._cache.abaSessions; },

    getAbaSessionsByTarget(targetId) {
        return this._cache.abaSessions
            .filter(s => s.targetId === targetId)
            .sort((a, b) => new Date(a.date) - new Date(b.date));
    },

    getAbaSessionsByPatient(patientId) {
        return this._cache.abaSessions
            .filter(s => s.patientId === patientId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getAbaSessionsByTherapist(therapistId) {
        return this._cache.abaSessions
            .filter(s => s.therapistId === therapistId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async addAbaSession(session) {
        session.id = 'abs' + Date.now();
        session.createdAt = new Date().toISOString();
        this._cache.abaSessions.push(session);
        try { await db.collection('abaSessions').doc(session.id).set(session); } catch (e) { console.error(e); }
        return session;
    },

    async removeAbaSession(id) {
        this._cache.abaSessions = this._cache.abaSessions.filter(s => s.id !== id);
        try { await db.collection('abaSessions').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== ESTATISTICAS ======
    getStats(therapistId = null) {
        const patients = therapistId ? this.getPatientsByTherapist(therapistId) : this.getPatients();
        const evolutions = therapistId ? this.getEvolutionsByTherapist(therapistId) : this.getEvolutions();
        const reports = therapistId ? this.getReportsByTherapist(therapistId) : this.getReports();

        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);

        return {
            totalPatients: patients.length,
            totalEvolutions: evolutions.length,
            totalReports: reports.length,
            evolutionsThisMonth: evolutions.filter(e => e.date && e.date.startsWith(thisMonth)).length
        };
    }
};
