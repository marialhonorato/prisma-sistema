/* ============================================
   PRISMA - Gerenciamento de Dados (Firebase)
   Carrega tudo na memória e sincroniza com Firestore
   v3.0 - 5 Roles, Multi-terapeuta, Agenda, Financeiro, Documentação, Atendimentos Família
   ============================================ */

const DB = {
    // Dados em memória (cache local)
    _cache: {
        users: [],
        patients: [],
        evolutions: [],
        reports: [],
        abaTargets: [],
        abaSessions: [],
        // Novas coleções v2
        agenda: [],
        attendance: [],
        payments: [],
        statements: [],
        reportRequests: [],
        notifications: [],
        therapeuticObjectives: [],
        devolutivas: [],
        // Novas coleções v3
        documents: [],
        familyMeetings: [],
        messages: [],
        reassessments: []
    },

    _ready: false,
    _onReadyCallbacks: [],
    _currentUser: 'Sistema',

    // ====== AUDIT LOG ======
    _auditLog(action, entity, details) {
        try {
            const log = JSON.parse(localStorage.getItem('prisma_audit_log') || '[]');
            log.unshift({
                timestamp: new Date().toISOString(),
                user: this._currentUser || 'Sistema',
                action: action,
                entity: entity,
                details: details
            });
            if (log.length > 500) log.length = 500;
            localStorage.setItem('prisma_audit_log', JSON.stringify(log));
        } catch(e) { console.error('Audit log error:', e); }
    },

    setCurrentUser(name) {
        this._currentUser = name;
    },

    // ====== INICIALIZAÇÃO ======
    async init() {
        try {
            // Timeout de 30s para não ficar preso se Firestore estiver lento
            const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout: Firestore demorou demais')), 30000));
            await Promise.race([this._loadAll(), timeout]);
            await this._ensureDefaults();
            await this._migrateTherapistIds();
            this._syncAllToLS();
            this._ready = true;
            this._onReadyCallbacks.forEach(cb => cb());
        } catch (err) {
            console.error('Erro ao conectar com Firebase:', err);
            this._useFallback();
            // Se localStorage tambem estava vazio, tentar Firestore sem timeout
            if (this._cache.agenda.length === 0) {
                console.warn('Fallback vazio — tentando Firestore novamente...');
                try {
                    await this._loadAll();
                    await this._ensureDefaults();
                    this._syncAllToLS();
                } catch (e2) { console.error('Segunda tentativa falhou:', e2); }
            }
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
        const collections = [
            'users', 'patients', 'evolutions', 'reports', 'abaTargets', 'abaSessions',
            'agenda', 'attendance', 'payments', 'statements', 'reportRequests',
            'notifications', 'therapeuticObjectives', 'devolutivas',
            'documents', 'familyMeetings', 'messages', 'reassessments'
        ];

        const snapshots = await Promise.all(
            collections.map(c => db.collection(c).get())
        );

        collections.forEach((name, i) => {
            this._cache[name] = snapshots[i].docs.map(d => ({ id: d.id, ...d.data() }));
        });
    },

    // Migrar therapistId (string) para therapistIds (array) em pacientes existentes
    async _migrateTherapistIds() {
        let needsMigration = false;
        for (const patient of this._cache.patients) {
            if (patient.therapistId && !patient.therapistIds) {
                patient.therapistIds = [patient.therapistId];
                delete patient.therapistId;
                needsMigration = true;
                try {
                    await db.collection('patients').doc(patient.id).set({
                        therapistIds: patient.therapistIds,
                        therapistId: firebase.firestore.FieldValue.delete()
                    }, { merge: true });
                } catch (e) { console.error('Erro migrando paciente:', e); }
            }
        }
        if (needsMigration) {
            console.log('Migração therapistId -> therapistIds concluída');
        }
    },

    async _ensureDefaults() {
        if (this._cache.users.length === 0) {
            const defaultUsers = [
                {
                    id: 'coord1',
                    name: 'Coordenação Prisma',
                    username: 'coordenacao',
                    password: 'prisma2025',
                    role: 'coordenacao',
                    specialty: 'Coordenação Geral',
                    email: '',
                    phone: ''
                },
                {
                    id: 'dir1',
                    name: 'Diretor 1',
                    username: 'diretor1',
                    password: 'prisma2025',
                    role: 'direcao',
                    specialty: 'Direção',
                    email: '',
                    phone: ''
                },
                {
                    id: 'dir2',
                    name: 'Diretor 2',
                    username: 'diretor2',
                    password: 'prisma2025',
                    role: 'direcao',
                    specialty: 'Direção',
                    email: '',
                    phone: ''
                },
                {
                    id: 'dir3',
                    name: 'Diretor 3',
                    username: 'diretor3',
                    password: 'prisma2025',
                    role: 'direcao',
                    specialty: 'Direção',
                    email: '',
                    phone: ''
                },
                {
                    id: 'dir4',
                    name: 'Diretor 4',
                    username: 'diretor4',
                    password: 'prisma2025',
                    role: 'direcao',
                    specialty: 'Direção',
                    email: '',
                    phone: ''
                },
                {
                    id: 'ter1',
                    name: 'Suelene Cibelle Silva dos Reis',
                    username: 'suelene.reis',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Fonoaudióloga',
                    email: '',
                    phone: ''
                },
                {
                    id: 'ter2',
                    name: 'Kadyja',
                    username: 'kadyja',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Psicóloga',
                    email: '',
                    phone: ''
                },
                {
                    id: 'ter3',
                    name: 'Erika Siqueira Machado',
                    username: 'erika.machado',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Terapeuta Ocupacional / Psicopedagoga',
                    email: '',
                    phone: ''
                },
                {
                    id: 'ter4',
                    name: 'Wescley Guilherme da Mota',
                    username: 'wescley.mota',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Terapeuta Ocupacional IS',
                    email: '',
                    phone: ''
                },
                {
                    id: 'ter5',
                    name: 'Wilaine',
                    username: 'wilaine',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Psicomotricista',
                    email: '',
                    phone: ''
                },
                {
                    id: 'ter6',
                    name: 'Wanessa',
                    username: 'wanessa',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Psicóloga / Psicopedagoga',
                    email: '',
                    phone: ''
                },
                {
                    id: 'ter7',
                    name: 'Julio',
                    username: 'julio',
                    password: 'prisma123',
                    role: 'terapeuta',
                    specialty: 'Terapeuta',
                    email: '',
                    phone: ''
                },
            ];

            const batch = db.batch();
            for (const user of defaultUsers) {
                const ref = db.collection('users').doc(user.id);
                batch.set(ref, user);
            }
            await batch.commit();
            this._cache.users = [...defaultUsers];
        } else {
            // Garantir que usuários de direção existam mesmo se banco já tem dados
            const direcaoDefaults = [
                { id: 'dir1', name: 'Diretor 1', username: 'diretor1', password: 'prisma2025', role: 'direcao', specialty: 'Direção', email: '', phone: '' },
                { id: 'dir2', name: 'Diretor 2', username: 'diretor2', password: 'prisma2025', role: 'direcao', specialty: 'Direção', email: '', phone: '' },
                { id: 'dir3', name: 'Diretor 3', username: 'diretor3', password: 'prisma2025', role: 'direcao', specialty: 'Direção', email: '', phone: '' },
                { id: 'dir4', name: 'Diretor 4', username: 'diretor4', password: 'prisma2025', role: 'direcao', specialty: 'Direção', email: '', phone: '' }
            ];
            const missingDirecao = direcaoDefaults.filter(d => !this._cache.users.find(u => u.id === d.id));
            if (missingDirecao.length > 0) {
                const batchDir = db.batch();
                for (const user of missingDirecao) {
                    user.createdAt = new Date().toISOString();
                    batchDir.set(db.collection('users').doc(user.id), user);
                    this._cache.users.push(user);
                }
                await batchDir.commit();
            }
            // Garantir que usuário ADM exista
            const admDefault = { id: 'adm1', name: 'Administração Prisma', username: 'adm', password: 'prisma2025', role: 'adm', specialty: 'Administração', email: '', phone: '' };
            if (!this._cache.users.find(u => u.id === 'adm1')) {
                admDefault.createdAt = new Date().toISOString();
                try { await db.collection('users').doc(admDefault.id).set(admDefault); } catch(e) { console.error(e); }
                this._cache.users.push(admDefault);
            }

            // Garantir que terapeutas existam
            const terapeutaDefaults = [
                { id: 'ter1', name: 'Suelene Cibelle Silva dos Reis', username: 'suelene.reis', password: 'prisma123', role: 'terapeuta', specialty: 'Fonoaudióloga', email: '', phone: '' },
                { id: 'ter2', name: 'Kadyja', username: 'kadyja', password: 'prisma123', role: 'terapeuta', specialty: 'Psicóloga', email: '', phone: '' },
                { id: 'ter3', name: 'Erika Siqueira Machado', username: 'erika.machado', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta Ocupacional / Psicopedagoga', email: '', phone: '' },
                { id: 'ter4', name: 'Wescley Guilherme da Mota', username: 'wescley.mota', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta Ocupacional IS', email: '', phone: '' },
                { id: 'ter5', name: 'Wilaine', username: 'wilaine', password: 'prisma123', role: 'terapeuta', specialty: 'Psicomotricista', email: '', phone: '' },
                { id: 'ter6', name: 'Wanessa', username: 'wanessa', password: 'prisma123', role: 'terapeuta', specialty: 'Psicóloga / Psicopedagoga', email: '', phone: '' },
                { id: 'ter7', name: 'Julio', username: 'julio', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta', email: '', phone: '' },
                { id: 'ter9', name: 'Márcio', username: 'marcio', password: 'prisma123', role: 'terapeuta', specialty: 'Musicoterapeuta', email: '', phone: '' },
                { id: 'ter10', name: 'Thaysa', username: 'thaysa', password: 'prisma123', role: 'terapeuta', specialty: 'Nutricionista', email: '', phone: '' }
            ];
            const missingTer = terapeutaDefaults.filter(t => !this._cache.users.find(u => u.id === t.id));
            if (missingTer.length > 0) {
                console.log('[DB] Adicionando ' + missingTer.length + ' terapeutas faltantes');
                const batchTer = db.batch();
                for (const user of missingTer) {
                    user.createdAt = new Date().toISOString();
                    batchTer.set(db.collection('users').doc(user.id), user);
                    this._cache.users.push(user);
                }
                try { await batchTer.commit(); } catch(e) { console.error('Erro ao salvar terapeutas:', e); }
            }

            // Garantir campos email/phone em usuários existentes
            this._cache.users.forEach(u => {
                if (u.email === undefined) u.email = '';
                if (u.phone === undefined) u.phone = '';
            });
        }

        // Criar pacientes padrão se não existirem
        if (this._cache.patients.length === 0) {
            const defaultPatients = [
                { id: 'pac1', name: 'Joao Fernandes Valente', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: 'Bradesco', serie: 'Infantil 3', turno: 'Manhã', notes: 'Fono Particular. Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter1', 'ter6'] },
                { id: 'pac2', name: 'Caio Oliveira', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: 'Bradesco', serie: 'Infantil 3', turno: 'Manhã', notes: 'Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter6'] },
                { id: 'pac3', name: 'Lucca Honorato', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: 'Infantil 5', turno: 'Manhã', notes: 'Clínica NIFAZ. Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter2'] },
                { id: 'pac4', name: 'Lucas Alves', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: '1o ano', turno: 'Tarde', notes: 'Route. Escola: Rede ELO - Boa Viagem.', therapistIds: [] },
                { id: 'pac5', name: 'Bela', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: 'Infantil 5', turno: 'Manhã', notes: 'Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter2'] },
                { id: 'pac6', name: 'Mateus', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: 'Infantil 5', turno: 'Manhã', notes: 'Quinzenal. Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter6'] },
                { id: 'pac7', name: 'Martim', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: 'Infantil 5', turno: 'Manhã', notes: 'Quinzenal. Escola: Rede ELO - Boa Viagem.', therapistIds: [] },
                { id: 'pac8', name: 'Laura', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: 'GERF/Particular', serie: 'Infantil 5', turno: 'Manhã', notes: 'Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter1'] },
                { id: 'pac9', name: 'Sofia', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: '', turno: '', notes: '', therapistIds: ['ter2'] },
                { id: 'pac10', name: 'Ana Laura Berto Fernandes', birthDate: '', guardian: 'Camila Oliveira', phone: '', diagnosis: '', insurance: 'Particular', serie: '', turno: 'Manhã', notes: 'Terapias finalizam às 12h. Sem AT.', therapistIds: ['ter1', 'ter2', 'ter5', 'ter6', 'ter10'] }
            ];

            const batch2 = db.batch();
            for (const patient of defaultPatients) {
                patient.createdAt = new Date().toISOString();
                const ref = db.collection('patients').doc(patient.id);
                batch2.set(ref, patient);
            }
            await batch2.commit();
            this._cache.patients = [...defaultPatients];
        }

        // Garantir que Sofia (pac9) exista antes de criar contas
        if (!this._cache.patients.find(p => p.id === 'pac9')) {
            const sofia = { id: 'pac9', name: 'Sofia', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: '', turno: '', notes: '', therapistIds: ['ter2'], createdAt: new Date().toISOString() };
            this._cache.patients.push(sofia);
            this._syncToLS('patients');
            try { await db.collection('patients').doc('pac9').set(sofia); } catch(e) { console.error(e); }
        }

        // Garantir contas de paciente para todos os pacientes
        // Credenciais fixas para cada paciente
        const fixedCredentials = {
            'pac1': { username: 'joao.valente', password: 'prisma1001' },
            'pac2': { username: 'caio.oliveira', password: 'prisma1002' },
            'pac3': { username: 'lucca.honorato', password: 'prisma1003' },
            'pac4': { username: 'lucas.alves', password: 'prisma1004' },
            'pac5': { username: 'bela', password: 'prisma1005' },
            'pac6': { username: 'mateus', password: 'prisma1006' },
            'pac7': { username: 'martim', password: 'prisma1007' },
            'pac8': { username: 'laura', password: 'prisma1008' },
            'pac9': { username: 'sofia', password: 'prisma1009' },
            'pac10': { username: 'ana.laura', password: 'prisma1010' }
        };
        for (const patient of this._cache.patients) {
            const hasAccount = this._cache.users.find(u => u.role === 'paciente' && u.patientId === patient.id);
            if (!hasAccount) {
                const fixed = fixedCredentials[patient.id];
                const creds = fixed || this.generatePatientCredentials(patient.name);
                const pacUser = {
                    id: 'pac_user_' + patient.id,
                    name: patient.name,
                    username: creds.username,
                    password: creds.password,
                    role: 'paciente',
                    specialty: 'Paciente',
                    patientId: patient.id,
                    email: '',
                    phone: '',
                    createdAt: new Date().toISOString()
                };
                this._cache.users.push(pacUser);
                try { await db.collection('users').doc(pacUser.id).set(pacUser); } catch(e) { console.error(e); }
            }
        }

        // Popular agenda default SOMENTE se Firestore não tem dados
        if (this._cache.agenda.length === 0) {
            await this._populateDefaultAgenda();
        }
        localStorage.setItem('prisma_agenda_version', '4');

        // Popular espelhos SOMENTE se Firestore não tem dados
        if (this._cache.statements.length === 0) {
            await this._populateDefaultStatements();
        }
        localStorage.setItem('prisma_stm_version', '4');

        // Forçar atualização de pacientes
        const patVersion = localStorage.getItem('prisma_pat_version') || '0';
        if (patVersion < '4') {
            const patUpdates = {
                'pac1': { name: 'Joao Fernandes Valente', therapistIds: ['ter1', 'ter6'], diagnosis: '', insurance: 'Bradesco', serie: '', turno: '' },
                'pac2': { name: 'Caio Oliveira', therapistIds: ['ter6'], diagnosis: '', insurance: 'Bradesco', serie: '', turno: '' },
                'pac3': { name: 'Lucca Honorato', therapistIds: ['ter2'], diagnosis: '', insurance: '', serie: '', turno: '' },
                'pac4': { name: 'Lucas Alves', therapistIds: [], diagnosis: '', insurance: '', serie: '', turno: '' },
                'pac5': { name: 'Bela', therapistIds: ['ter2'], diagnosis: '', insurance: '', serie: '', turno: '' },
                'pac6': { name: 'Mateus', therapistIds: ['ter6'], diagnosis: '', insurance: '', serie: '', turno: '' },
                'pac7': { name: 'Martim', therapistIds: [], diagnosis: '', insurance: '', serie: '', turno: '' },
                'pac8': { name: 'Laura', therapistIds: ['ter1'], diagnosis: '', insurance: 'GERF/Particular', serie: '', turno: '' },
                'pac9': { name: 'Sofia', therapistIds: ['ter2'], diagnosis: '', insurance: '', serie: '', turno: '' },
                'pac10': { name: 'Ana Laura Berto Fernandes', therapistIds: ['ter1', 'ter2', 'ter5', 'ter6', 'ter10'], diagnosis: '', insurance: 'Particular', serie: '', turno: 'Manhã' }
            };
            for (const [pacId, updates] of Object.entries(patUpdates)) {
                const existing = this._cache.patients.find(p => p.id === pacId);
                if (existing) {
                    Object.assign(existing, updates);
                    try { await db.collection('patients').doc(pacId).set(updates, { merge: true }); } catch(e) {}
                }
            }
            this._syncToLS('patients');
            localStorage.setItem('prisma_pat_version', '5');
        }

        // (Sofia já garantida acima)

        // Sincronizar relatorios do localStorage que nao estao no Firestore
        const lsReports = JSON.parse(localStorage.getItem('prisma_reports') || '[]');
        for (const lsRep of lsReports) {
            if (!this._cache.reports.find(r => r.id === lsRep.id)) {
                this._cache.reports.push(lsRep);
            }
            try {
                const snap = await db.collection('reports').doc(lsRep.id).get();
                if (!snap.exists) {
                    // Relatorio nao existe no Firestore, salvar tudo (com chunks para arquivo)
                    await this._saveToFirestoreWithFallback('reports', lsRep.id, lsRep, 'set');
                } else if (lsRep.fileData && !snap.data().hasFile) {
                    // Relatorio existe mas arquivo nao foi enviado ainda, enviar chunks
                    await this._saveToFirestoreWithFallback('reports', lsRep.id, { fileData: lsRep.fileData, fileName: lsRep.fileName, fileType: lsRep.fileType }, 'update');
                }
            } catch(e) { console.error('Erro sync relatorio:', e); }
        }

        // Popular pagamentos SOMENTE se Firestore não tem dados
        if (this._cache.payments.length === 0) {
            const defaultPayments = [
                {
                    id: 'pay1',
                    patientId: 'pac5',
                    month: '2026-02',
                    amount: 380,
                    status: 'pago',
                    method: 'pix',
                    paymentDate: '2026-02-10',
                    notes: 'Pagamento 2 sessoes de Bela. Pix Nubank. Pagante: Brendha Sterfany Nascimento dos Santos. Destinatario: PRISMA SAUDE INTEGRADA - CNPJ: 62.466.894/0001-67',
                    createdAt: '2026-02-10T12:00:00.000Z'
                },
                {
                    id: 'pay2',
                    patientId: 'pac7',
                    month: '2026-02',
                    amount: 190,
                    status: 'pago',
                    method: 'pix',
                    paymentDate: '2026-02-11',
                    notes: 'Pagamento Martim. Pix Santander. Pagante: MILENA EDUARDA P DO NASCIMENTO VARIEDADES. Destinatario: PRISMA SAUDE INTEGRADA - CNPJ: 62.466.894/0001-67. Transacao: 11/02/2026 as 16:17:49',
                    createdAt: '2026-02-11T16:17:49.000Z'
                },
                {
                    id: 'pay3',
                    patientId: 'pac6',
                    month: '2026-02',
                    amount: 190,
                    status: 'pago',
                    method: 'pix',
                    paymentDate: '2026-02-12',
                    notes: 'Pagamento Mateus dia 12/02. Pix Nubank. Pagante: Renata da Fonseca Ferreira Silva e Silva. Conta: 9018/391-4 NU PAGAMENTOS. Destinatario: PRISMA SAUDE INTEGRADA - CNPJ: 62.466.894/0001-67',
                    createdAt: '2026-02-12T12:00:00.000Z'
                },
                {
                    id: 'pay4',
                    patientId: 'pac5',
                    month: '2026-02',
                    amount: 190,
                    status: 'pago',
                    method: 'pix',
                    paymentDate: '2026-02-24',
                    notes: 'Pagamento de Bela 24/02. Pix Nubank. Destinatario: PRISMA CENTRO DE SAUDE INTEGRADA',
                    createdAt: '2026-02-24T12:00:00.000Z'
                }
            ];

            const batchPay = db.batch();
            for (const pay of defaultPayments) {
                batchPay.set(db.collection('payments').doc(pay.id), pay);
            }
            await batchPay.commit();
            this._cache.payments = [...defaultPayments];
            this._syncToLS('payments');
            localStorage.setItem('prisma_pay_version', '2');
        }
    },

    async _populateDefaultAgenda() {
        // Horários semanais base - Quadro Geral Março 2026 (dados do Prisma Gerador)
        const schedules = [
            // Segunda-feira
            { patientId: 'pac2', therapistId: 'ter6', therapistName: 'Wanessa (Psicopedagogia)', dayOfWeek: 1, startTime: '15:45', endTime: '16:30' },
            { patientId: 'pac10', therapistId: 'ter2', therapistName: 'Kadyja (Psicologia)', dayOfWeek: 1, startTime: '10:30', endTime: '11:15' },
            { patientId: 'pac10', therapistId: 'ter2', therapistName: 'Kadyja (Psicologia)', dayOfWeek: 1, startTime: '11:15', endTime: '12:00' },
            // Terca-feira
            { patientId: 'pac5', therapistId: 'ter2', therapistName: 'Kadyja (Psicologia)', dayOfWeek: 2, startTime: '10:00', endTime: '10:45' },
            { patientId: 'pac10', therapistId: 'ter10', therapistName: 'Thaysa (Nutrição)', dayOfWeek: 2, startTime: '11:15', endTime: '12:00' },
            // Quarta-feira
            { patientId: 'pac1', therapistId: 'ter1', therapistName: 'Suelene (Fonoaudiologia)', dayOfWeek: 3, startTime: '16:30', endTime: '17:15' },
            { patientId: 'pac10', therapistId: 'ter1', therapistName: 'Suelene (Fonoaudiologia)', dayOfWeek: 3, startTime: '09:45', endTime: '11:15' },
            { patientId: 'pac10', therapistId: 'ter6', therapistName: 'Wanessa (Psicopedagogia)', dayOfWeek: 3, startTime: '11:15', endTime: '12:00' },
            // Quinta-feira
            { patientId: 'pac2', therapistId: 'ter6', therapistName: 'Wanessa (Psicopedagogia)', dayOfWeek: 4, startTime: '15:45', endTime: '16:30' },
            { patientId: 'pac6', therapistId: 'ter6', therapistName: 'Wanessa (Psicologia)', dayOfWeek: 4, startTime: '16:50', endTime: '17:35', quinzenal: true },
            { patientId: 'pac10', therapistId: 'ter5', therapistName: 'Wilaine (Psicomotricidade Funcional)', dayOfWeek: 4, startTime: '10:15', endTime: '11:15' },
            { patientId: 'pac10', therapistId: 'ter2', therapistName: 'Kadyja (Psicologia)', dayOfWeek: 4, startTime: '11:15', endTime: '12:00' },
            // Sexta-feira
            { patientId: 'pac1', therapistId: 'ter6', therapistName: 'Wanessa (Psicologia)', dayOfWeek: 5, startTime: '16:00', endTime: '16:45' },
            { patientId: 'pac8', therapistId: 'ter1', therapistName: 'Suelene (Fonoaudiologia)', dayOfWeek: 5, startTime: '16:00', endTime: '16:45' },
            { patientId: 'pac2', therapistId: 'ter6', therapistName: 'Wanessa (Psicopedagogia)', dayOfWeek: 5, startTime: '16:30', endTime: '17:15' },
            { patientId: 'pac10', therapistId: 'ter5', therapistName: 'Wilaine (Psicomotricidade Relacional)', dayOfWeek: 5, startTime: '11:00', endTime: '12:00' }
        ];

        const slots = [];
        let idCounter = 1;
        // Gerar para Março 2026 (02/03 a 31/03) + Abril ate 04/04
        const startDate = new Date(2026, 2, 2); // 02 Mar 2026 (segunda)
        const endDate = new Date(2026, 3, 4);   // 04 Abr 2026
        let quinzenalWeek = 0;

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay(); // 0=Dom, 1=Seg...
            if (dow === 0 || dow === 6) continue; // pula fim de semana

            // Checar se e nova semana (segunda)
            if (dow === 1) quinzenalWeek++;

            for (const sched of schedules) {
                if (sched.dayOfWeek !== dow) continue;
                // Quinzenais: apenas semanas impares
                if (sched.quinzenal && quinzenalWeek % 2 === 0) continue;

                const dateStr = d.toISOString().split('T')[0];
                const patient = this._cache.patients.find(p => p.id === sched.patientId);
                slots.push({
                    id: 'agd_def' + idCounter++,
                    patientId: sched.patientId,
                    patientName: patient ? patient.name : '',
                    therapistId: sched.therapistId,
                    therapistName: sched.therapistName,
                    date: dateStr,
                    startTime: sched.startTime,
                    endTime: sched.endTime,
                    shift: parseInt(sched.startTime) < 12 ? 'manha' : 'tarde',
                    status: 'agendado',
                    notes: '',
                    createdAt: new Date().toISOString()
                });
            }
        }

        // Salvar todos os slots
        this._cache.agenda = slots;
        for (const slot of slots) {
            try { await db.collection('agenda').doc(slot.id).set(slot); } catch(e) { console.error(e); }
        }
    },

    async _populateDefaultStatements() {
        // Precos por especialidade do terapeuta
        const precos = {
            'ter1': 290,  // Suelene - Fono
            'ter2': 240,  // Kadyja - Psicologa
            'ter3': 280,  // Erika - TO/Psicoped
            'ter4': 310,  // Wescley - TO IS
            'ter5': 310,  // Wilaine - Psicomotricista
            'ter6': 280,  // Wanessa - Psicologia/Psicopedagogia
            'ter7': 240   // Julio - Terapeuta
        };

        // Espelhos para 6 pacientes que estavam no zip: pac1, pac2, pac5, pac6, pac7, pac8
        const espelhoPacientes = ['pac1', 'pac2', 'pac5', 'pac6', 'pac7', 'pac8', 'pac10'];
        const statements = [];
        let stmCounter = 1;

        for (const pacId of espelhoPacientes) {
            const patient = this._cache.patients.find(p => p.id === pacId);
            if (!patient) continue;
            // Contar sessoes de Mar 2026 na agenda
            const febSlots = this._cache.agenda.filter(a => a.patientId === pacId && a.date.startsWith('2026-03'));
            const totalSessions = febSlots.length;
            // 80-90% presenca
            const attendanceRate = 0.8 + Math.random() * 0.1;
            const attendedSessions = Math.round(totalSessions * attendanceRate);
            const missedSessions = totalSessions - attendedSessions;

            // Calcular valor: soma dos precos por sessao de cada terapeuta
            let totalAmount = 0;
            for (const slot of febSlots) {
                totalAmount += precos[slot.therapistId] || 240;
            }
            const paidAmount = Math.round(totalAmount * 0.7); // 70% pago

            statements.push({
                id: 'stm_def' + stmCounter++,
                patientId: pacId,
                patientName: patient.name,
                type: 'mensal',
                period: '2026-03',
                totalSessions: totalSessions,
                attendedSessions: attendedSessions,
                missedSessions: missedSessions,
                totalAmount: totalAmount,
                paidAmount: paidAmount,
                notes: 'Espelho gerado automaticamente - Março 2026',
                generatedAt: '2026-03-01T10:00:00.000Z',
                createdAt: '2026-03-01T10:00:00.000Z'
            });
        }

        this._cache.statements = statements;
        for (const stm of statements) {
            try { await db.collection('statements').doc(stm.id).set(stm); } catch(e) { console.error(e); }
        }
    },

    _useFallback() {
        console.warn('Usando localStorage como fallback');
        // Carregar todas as coleções do localStorage
        const allCollections = ['users', 'patients', 'evolutions', 'reports', 'abaTargets', 'abaSessions',
            'agenda', 'attendance', 'payments', 'statements', 'reportRequests',
            'notifications', 'therapeuticObjectives', 'devolutivas',
            'documents', 'familyMeetings', 'messages', 'reassessments'];
        allCollections.forEach(name => {
            this._cache[name] = JSON.parse(localStorage.getItem('prisma_' + name) || '[]');
        });

        // Se não tem usuários, criar defaults
        if (this._cache.users.length === 0) {
            this._cache.users = [
                { id: 'coord1', name: 'Coordenação Prisma', username: 'coordenacao', password: 'prisma2025', role: 'coordenacao', specialty: 'Coordenação Geral', email: '', phone: '' },
                { id: 'ter1', name: 'Suelene Cibelle Silva dos Reis', username: 'suelene.reis', password: 'prisma123', role: 'terapeuta', specialty: 'Fonoaudióloga', email: '', phone: '' },
                { id: 'ter2', name: 'Kadyja', username: 'kadyja', password: 'prisma123', role: 'terapeuta', specialty: 'Psicóloga', email: '', phone: '' },
                { id: 'ter3', name: 'Erika Siqueira Machado', username: 'erika.machado', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta Ocupacional / Psicopedagoga', email: '', phone: '' },
                { id: 'ter4', name: 'Wescley Guilherme da Mota', username: 'wescley.mota', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta Ocupacional IS', email: '', phone: '' },
                { id: 'ter5', name: 'Wilaine', username: 'wilaine', password: 'prisma123', role: 'terapeuta', specialty: 'Psicomotricista', email: '', phone: '' },
                { id: 'ter6', name: 'Wanessa', username: 'wanessa', password: 'prisma123', role: 'terapeuta', specialty: 'Psicóloga / Psicopedagoga', email: '', phone: '' },
                { id: 'ter7', name: 'Julio', username: 'julio', password: 'prisma123', role: 'terapeuta', specialty: 'Terapeuta', email: '', phone: '' },
                { id: 'ter9', name: 'Márcio', username: 'marcio', password: 'prisma123', role: 'terapeuta', specialty: 'Musicoterapeuta', email: '', phone: '' },
                { id: 'ter10', name: 'Thaysa', username: 'thaysa', password: 'prisma123', role: 'terapeuta', specialty: 'Nutricionista', email: '', phone: '' },
                { id: 'dir1', name: 'Diretor 1', username: 'diretor1', password: 'prisma2025', role: 'direcao', specialty: 'Direção', email: '', phone: '' },
                { id: 'dir2', name: 'Diretor 2', username: 'diretor2', password: 'prisma2025', role: 'direcao', specialty: 'Direção', email: '', phone: '' },
                { id: 'dir3', name: 'Diretor 3', username: 'diretor3', password: 'prisma2025', role: 'direcao', specialty: 'Direção', email: '', phone: '' },
                { id: 'dir4', name: 'Diretor 4', username: 'diretor4', password: 'prisma2025', role: 'direcao', specialty: 'Direção', email: '', phone: '' },
                { id: 'adm1', name: 'Administração Prisma', username: 'adm', password: 'prisma2025', role: 'adm', specialty: 'Administração', email: '', phone: '' }
            ];
        }

        // Garantir Sofia no fallback tambem
        if (!this._cache.patients.find(p => p.id === 'pac9')) {
            this._cache.patients.push({ id: 'pac9', name: 'Sofia', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: '', turno: '', notes: '', therapistIds: ['ter2'], createdAt: new Date().toISOString() });
        }

        // Se não tem pacientes, criar defaults
        if (this._cache.patients.length === 0) {
            this._cache.patients = [
                { id: 'pac1', name: 'Joao Fernandes Valente', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: 'Bradesco', serie: 'Infantil 3', turno: 'Manhã', notes: 'Fono Particular. Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter1', 'ter6'] },
                { id: 'pac2', name: 'Caio Oliveira', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: 'Bradesco', serie: 'Infantil 3', turno: 'Manhã', notes: 'Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter6'] },
                { id: 'pac3', name: 'Lucca Honorato', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: 'Infantil 5', turno: 'Manhã', notes: 'Clínica NIFAZ. Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter2'] },
                { id: 'pac4', name: 'Lucas Alves', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: '1o ano', turno: 'Tarde', notes: 'Route. Escola: Rede ELO - Boa Viagem.', therapistIds: [] },
                { id: 'pac5', name: 'Bela', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: 'Infantil 5', turno: 'Manhã', notes: 'Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter2'] },
                { id: 'pac6', name: 'Mateus', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: 'Infantil 5', turno: 'Manhã', notes: 'Quinzenal. Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter6'] },
                { id: 'pac7', name: 'Martim', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: 'Infantil 5', turno: 'Manhã', notes: 'Quinzenal. Escola: Rede ELO - Boa Viagem.', therapistIds: [] },
                { id: 'pac8', name: 'Laura', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: 'GERF/Particular', serie: 'Infantil 5', turno: 'Manhã', notes: 'Escola: Rede ELO - Boa Viagem.', therapistIds: ['ter1'] },
                { id: 'pac9', name: 'Sofia', birthDate: '', guardian: '', phone: '', diagnosis: '', insurance: '', serie: '', turno: '', notes: '', therapistIds: ['ter2'] },
                { id: 'pac10', name: 'Ana Laura Berto Fernandes', birthDate: '', guardian: 'Camila Oliveira', phone: '', diagnosis: '', insurance: 'Particular', serie: '', turno: 'Manhã', notes: 'Terapias finalizam às 12h. Sem AT.', therapistIds: ['ter1', 'ter2', 'ter5', 'ter6', 'ter10'] }
            ];
        }

        // Se não tem contas de paciente, criar
        const fixedCreds = {
            'pac1': { username: 'joao.valente', password: 'prisma1001' },
            'pac2': { username: 'caio.oliveira', password: 'prisma1002' },
            'pac3': { username: 'lucca.honorato', password: 'prisma1003' },
            'pac4': { username: 'lucas.alves', password: 'prisma1004' },
            'pac5': { username: 'bela', password: 'prisma1005' },
            'pac6': { username: 'mateus', password: 'prisma1006' },
            'pac7': { username: 'martim', password: 'prisma1007' },
            'pac8': { username: 'laura', password: 'prisma1008' },
            'pac9': { username: 'sofia', password: 'prisma1009' },
            'pac10': { username: 'ana.laura', password: 'prisma1010' }
        };
        for (const patient of this._cache.patients) {
            const hasAccount = this._cache.users.find(u => u.role === 'paciente' && u.patientId === patient.id);
            if (!hasAccount && fixedCreds[patient.id]) {
                this._cache.users.push({
                    id: 'pac_user_' + patient.id,
                    name: patient.name,
                    username: fixedCreds[patient.id].username,
                    password: fixedCreds[patient.id].password,
                    role: 'paciente',
                    specialty: 'Paciente',
                    patientId: patient.id,
                    email: '', phone: ''
                });
            }
        }

        // Popular agenda SOMENTE se Firestore não tem dados
        if (this._cache.agenda.length === 0) {
            this._populateDefaultAgendaSync();
            // Salvar defaults no Firestore em background (não bloqueia init)
            try {
                const batchSize = 500;
                for (let i = 0; i < this._cache.agenda.length; i += batchSize) {
                    const batchAgd = db.batch();
                    this._cache.agenda.slice(i, i + batchSize).forEach(slot => {
                        batchAgd.set(db.collection('agenda').doc(slot.id), slot);
                    });
                    batchAgd.commit().catch(e => console.error('Erro batch agenda:', e));
                }
            } catch(e) { console.error('Erro salvando agenda defaults:', e); }
        }
        localStorage.setItem('prisma_agenda_version', '4');

        // Popular espelhos SOMENTE se Firestore não tem dados
        if (this._cache.statements.length === 0) {
            this._populateDefaultStatementsSync();
        }
        localStorage.setItem('prisma_stm_version', '4');

        // Popular pagamentos SOMENTE se Firestore não tem dados
        if (this._cache.payments.length === 0) {
            this._cache.payments = [
                { id: 'pay1', patientId: 'pac5', month: '2026-02', amount: 380, status: 'pago', method: 'pix', paymentDate: '2026-02-10', notes: 'Pagamento 2 sessoes de Bela. Pix Nubank. Pagante: Brendha Sterfany Nascimento dos Santos. Destinatario: PRISMA SAUDE INTEGRADA - CNPJ: 62.466.894/0001-67', createdAt: '2026-02-10T12:00:00.000Z' },
                { id: 'pay2', patientId: 'pac7', month: '2026-02', amount: 190, status: 'pago', method: 'pix', paymentDate: '2026-02-11', notes: 'Pagamento Martim. Pix Santander. Pagante: MILENA EDUARDA P DO NASCIMENTO VARIEDADES. Destinatario: PRISMA SAUDE INTEGRADA - CNPJ: 62.466.894/0001-67. Transacao: 11/02/2026 as 16:17:49', createdAt: '2026-02-11T16:17:49.000Z' },
                { id: 'pay3', patientId: 'pac6', month: '2026-02', amount: 190, status: 'pago', method: 'pix', paymentDate: '2026-02-12', notes: 'Pagamento Mateus dia 12/02. Pix Nubank. Pagante: Renata da Fonseca Ferreira Silva e Silva. Conta: 9018/391-4 NU PAGAMENTOS. Destinatario: PRISMA SAUDE INTEGRADA - CNPJ: 62.466.894/0001-67', createdAt: '2026-02-12T12:00:00.000Z' },
                { id: 'pay4', patientId: 'pac5', month: '2026-02', amount: 190, status: 'pago', method: 'pix', paymentDate: '2026-02-24', notes: 'Pagamento de Bela 24/02. Pix Nubank. Destinatario: PRISMA CENTRO DE SAUDE INTEGRADA', createdAt: '2026-02-24T12:00:00.000Z' }
            ];
        }
        localStorage.setItem('prisma_pay_version', '2');

        // Salvar tudo no localStorage
        this._syncAllToLS();
    },

    _populateDefaultAgendaSync() {
        const schedules = [
            // Segunda
            { patientId: 'pac2', therapistId: 'ter6', therapistName: 'Wanessa (Psicopedagogia)', dayOfWeek: 1, startTime: '15:45', endTime: '16:30' },
            { patientId: 'pac10', therapistId: 'ter2', therapistName: 'Kadyja (Psicologia)', dayOfWeek: 1, startTime: '10:30', endTime: '11:15' },
            { patientId: 'pac10', therapistId: 'ter2', therapistName: 'Kadyja (Psicologia)', dayOfWeek: 1, startTime: '11:15', endTime: '12:00' },
            // Terca
            { patientId: 'pac5', therapistId: 'ter2', therapistName: 'Kadyja (Psicologia)', dayOfWeek: 2, startTime: '10:00', endTime: '10:45' },
            { patientId: 'pac10', therapistId: 'ter10', therapistName: 'Thaysa (Nutrição)', dayOfWeek: 2, startTime: '11:15', endTime: '12:00' },
            // Quarta
            { patientId: 'pac1', therapistId: 'ter1', therapistName: 'Suelene (Fonoaudiologia)', dayOfWeek: 3, startTime: '16:30', endTime: '17:15' },
            { patientId: 'pac10', therapistId: 'ter1', therapistName: 'Suelene (Fonoaudiologia)', dayOfWeek: 3, startTime: '09:45', endTime: '11:15' },
            { patientId: 'pac10', therapistId: 'ter6', therapistName: 'Wanessa (Psicopedagogia)', dayOfWeek: 3, startTime: '11:15', endTime: '12:00' },
            // Quinta
            { patientId: 'pac2', therapistId: 'ter6', therapistName: 'Wanessa (Psicopedagogia)', dayOfWeek: 4, startTime: '15:45', endTime: '16:30' },
            { patientId: 'pac6', therapistId: 'ter6', therapistName: 'Wanessa (Psicologia)', dayOfWeek: 4, startTime: '16:50', endTime: '17:35', quinzenal: true },
            { patientId: 'pac10', therapistId: 'ter5', therapistName: 'Wilaine (Psicomotricidade Funcional)', dayOfWeek: 4, startTime: '10:15', endTime: '11:15' },
            { patientId: 'pac10', therapistId: 'ter2', therapistName: 'Kadyja (Psicologia)', dayOfWeek: 4, startTime: '11:15', endTime: '12:00' },
            // Sexta
            { patientId: 'pac1', therapistId: 'ter6', therapistName: 'Wanessa (Psicologia)', dayOfWeek: 5, startTime: '16:00', endTime: '16:45' },
            { patientId: 'pac8', therapistId: 'ter1', therapistName: 'Suelene (Fonoaudiologia)', dayOfWeek: 5, startTime: '16:00', endTime: '16:45' },
            { patientId: 'pac2', therapistId: 'ter6', therapistName: 'Wanessa (Psicopedagogia)', dayOfWeek: 5, startTime: '16:30', endTime: '17:15' },
            { patientId: 'pac10', therapistId: 'ter5', therapistName: 'Wilaine (Psicomotricidade Relacional)', dayOfWeek: 5, startTime: '11:00', endTime: '12:00' }
        ];
        const slots = [];
        let idCounter = 1;
        const startDate = new Date(2026, 2, 2);
        const endDate = new Date(2026, 3, 4);
        let quinzenalWeek = 0;
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dow = d.getDay();
            if (dow === 0 || dow === 6) continue;
            if (dow === 1) quinzenalWeek++;
            for (const sched of schedules) {
                if (sched.dayOfWeek !== dow) continue;
                if (sched.quinzenal && quinzenalWeek % 2 === 0) continue;
                const dateStr = d.toISOString().split('T')[0];
                const patient = this._cache.patients.find(p => p.id === sched.patientId);
                slots.push({
                    id: 'agd_def' + idCounter++,
                    patientId: sched.patientId,
                    patientName: patient ? patient.name : '',
                    therapistId: sched.therapistId,
                    therapistName: sched.therapistName,
                    date: dateStr,
                    startTime: sched.startTime,
                    endTime: sched.endTime,
                    shift: parseInt(sched.startTime) < 12 ? 'manha' : 'tarde',
                    status: 'agendado',
                    notes: '',
                    createdAt: new Date().toISOString()
                });
            }
        }
        this._cache.agenda = slots;
    },

    _populateDefaultStatementsSync() {
        const precos = { 'ter1': 290, 'ter2': 240, 'ter3': 280, 'ter4': 310, 'ter5': 310, 'ter6': 280, 'ter7': 240, 'ter10': 250 };
        const espelhoPacientes = ['pac1', 'pac2', 'pac5', 'pac6', 'pac7', 'pac8', 'pac10'];
        const statements = [];
        let stmCounter = 1;
        for (const pacId of espelhoPacientes) {
            const patient = this._cache.patients.find(p => p.id === pacId);
            if (!patient) continue;
            const marSlots = this._cache.agenda.filter(a => a.patientId === pacId && a.date.startsWith('2026-03'));
            const totalSessions = marSlots.length;
            const attendanceRate = 0.8 + Math.random() * 0.1;
            const attendedSessions = Math.round(totalSessions * attendanceRate);
            const missedSessions = totalSessions - attendedSessions;
            let totalAmount = 0;
            for (const slot of marSlots) { totalAmount += precos[slot.therapistId] || 240; }
            const paidAmount = Math.round(totalAmount * 0.7);
            statements.push({
                id: 'stm_def' + stmCounter++,
                patientId: pacId, patientName: patient.name, type: 'mensal', period: '2026-03',
                totalSessions, attendedSessions, missedSessions, totalAmount, paidAmount,
                notes: 'Espelho gerado automaticamente - Março 2026',
                generatedAt: '2026-03-01T10:00:00.000Z', createdAt: '2026-03-01T10:00:00.000Z'
            });
        }
        this._cache.statements = statements;
    },

    // ====== USUARIOS ======
    getUsers() {
        return this._cache.users;
    },

    getTherapists() {
        return this._cache.users.filter(u => u.role === 'terapeuta');
    },

    getUsersByRole(role) {
        return this._cache.users.filter(u => u.role === role);
    },

    getUserById(id) {
        return this._cache.users.find(u => u.id === id);
    },

    async addUser(user) {
        const prefix = { coordenacao: 'coord', terapeuta: 'ter', adm: 'adm', paciente: 'pac_user', direcao: 'dir' };
        user.id = (prefix[user.role] || 'usr') + Date.now();
        user.createdAt = new Date().toISOString();
        this._cache.users.push(user);
        this._syncToLS('users');
        try {
            await db.collection('users').doc(user.id).set(user);
        } catch (e) { console.error(e); }
        return user;
    },

    async removeUser(id) {
        this._cache.users = this._cache.users.filter(u => u.id !== id);
        this._syncToLS('users');
        try {
            await db.collection('users').doc(id).delete();
        } catch (e) { console.error(e); }
    },

    authenticate(username, password) {
        return this._cache.users.find(u => u.username === username && u.password === password) || null;
    },

    // Gerar credenciais de paciente automaticamente
    generatePatientCredentials(patientName) {
        const parts = patientName.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/);
        let username = parts.length >= 2 ? parts[0] + '.' + parts[parts.length - 1] : parts[0];
        // Garantir username unico
        let finalUsername = username;
        let counter = 1;
        while (this._cache.users.find(u => u.username === finalUsername)) {
            finalUsername = username + counter;
            counter++;
        }
        const digits = String(Math.floor(1000 + Math.random() * 9000));
        const password = 'prisma' + digits;
        return { username: finalUsername, password: password };
    },

    // Criar usuario paciente automaticamente ao cadastrar paciente
    async createPatientUser(patientName, patientId) {
        const creds = this.generatePatientCredentials(patientName);
        const user = {
            id: 'pac_user' + Date.now(),
            name: patientName,
            username: creds.username,
            password: creds.password,
            role: 'paciente',
            specialty: 'Paciente',
            patientId: patientId,
            createdAt: new Date().toISOString()
        };
        this._cache.users.push(user);
        this._syncToLS('users');
        try {
            await db.collection('users').doc(user.id).set(user);
        } catch (e) { console.error(e); }
        return user;
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

    getRouteForRole(role) {
        const routes = {
            coordenacao: 'coordenacao.html',
            terapeuta: 'terapeuta.html',
            adm: 'adm.html',
            direcao: 'direcao.html',
            paciente: 'paciente.html'
        };
        return routes[role] || 'login.html';
    },

    // ====== PACIENTES ======
    getPatients() {
        return this._cache.patients;
    },

    getPatientById(id) {
        return this._cache.patients.find(p => p.id === id);
    },

    // Multi-terapeuta: busca pacientes onde therapistIds contem o id
    getPatientsByTherapist(therapistId) {
        return this._cache.patients.filter(p => {
            if (p.therapistIds && Array.isArray(p.therapistIds)) {
                return p.therapistIds.includes(therapistId);
            }
            // Fallback para therapistId antigo
            return p.therapistId === therapistId;
        });
    },

    async addPatient(patient) {
        patient.id = 'pac' + Date.now();
        patient.createdAt = new Date().toISOString();
        // Garantir que therapistIds e um array
        if (patient.therapistId && !patient.therapistIds) {
            patient.therapistIds = [patient.therapistId];
            delete patient.therapistId;
        }
        if (!patient.therapistIds) {
            patient.therapistIds = [];
        }
        this._cache.patients.push(patient);
        this._syncToLS('patients');
        try {
            await db.collection('patients').doc(patient.id).set(patient);
        } catch (e) { console.error(e); }
        this._auditLog('create', 'patient', 'Paciente criado: ' + patient.name);
        return patient;
    },

    async updatePatient(id, data) {
        const idx = this._cache.patients.findIndex(p => p.id === id);
        if (idx !== -1) {
            // Migrar therapistId para therapistIds se necessario
            if (data.therapistId && !data.therapistIds) {
                data.therapistIds = [data.therapistId];
                delete data.therapistId;
            }
            this._cache.patients[idx] = { ...this._cache.patients[idx], ...data };
            this._syncToLS('patients');
            try {
                await db.collection('patients').doc(id).set(data, { merge: true });
            } catch (e) { console.error(e); }
            this._auditLog('update', 'patient', 'Paciente atualizado: ' + (data.name || id));
        }
    },

    async removePatient(id) {
        this._cache.patients = this._cache.patients.filter(p => p.id !== id);
        this._cache.evolutions = this._cache.evolutions.filter(e => e.patientId !== id);
        this._syncToLS('patients');
        this._syncToLS('evolutions');
        try {
            await db.collection('patients').doc(id).delete();
            const evosSnap = await db.collection('evolutions').where('patientId', '==', id).get();
            const batch = db.batch();
            evosSnap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        } catch (e) { console.error(e); }
        this._auditLog('delete', 'patient', 'Paciente removido: ' + id);
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
        this._syncToLS('evolutions');
        try {
            await db.collection('evolutions').doc(evolution.id).set(evolution);
        } catch (e) { console.error(e); }
        this._auditLog('create', 'evolution', 'Evolucao registrada: ' + (evolution.patientId || ''));
        return evolution;
    },

    async updateEvolution(id, data) {
        const idx = this._cache.evolutions.findIndex(e => e.id === id);
        if (idx !== -1) {
            this._cache.evolutions[idx] = { ...this._cache.evolutions[idx], ...data };
            this._syncToLS('evolutions');
            try {
                await db.collection('evolutions').doc(id).set(data, { merge: true });
            } catch (e) { console.error(e); }
            this._auditLog('update', 'evolution', 'Evolucao atualizada: ' + id);
        }
    },

    async removeEvolution(id) {
        this._cache.evolutions = this._cache.evolutions.filter(e => e.id !== id);
        this._syncToLS('evolutions');
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
            .filter(r => r.therapistId === therapistId || (r.therapistIds && r.therapistIds.includes(therapistId)))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    async _saveToFirestoreWithFallback(collection, docId, data, action) {
        const fileData = data.fileData;
        // Sempre salvar o documento principal sem fileData
        const clean = { ...data };
        delete clean.fileData;
        // Garantir que fileName e hasFile estejam no doc principal
        if (fileData) {
            clean.hasFile = true;
            clean.fileName = data.fileName || '';
            clean.fileType = data.fileType || '';
        }
        try {
            if (action === 'set') await db.collection(collection).doc(docId).set(clean);
            else await db.collection(collection).doc(docId).set(clean, { merge: true });
            console.log('Doc principal salvo:', collection, docId);
        } catch (e) { console.error('Erro ao salvar doc principal no Firestore:', e); return false; }

        // Salvar fileData em documentos separados (chunks de 700KB para maior seguranca)
        if (fileData) {
            try {
                const chunkSize = 700000;
                const totalChunks = Math.ceil(fileData.length / chunkSize);
                console.log('Salvando', totalChunks, 'chunks para', docId, '(tamanho total:', fileData.length, ')');
                for (let i = 0; i < totalChunks; i++) {
                    const chunk = fileData.substring(i * chunkSize, (i + 1) * chunkSize);
                    await db.collection(collection + '_files').doc(docId + '_chunk_' + i).set({
                        parentId: docId,
                        chunkIndex: i,
                        totalChunks: totalChunks,
                        data: chunk,
                        fileName: data.fileName || '',
                        fileType: data.fileType || ''
                    });
                    console.log('Chunk', i, 'salvo (' + chunk.length + ' bytes)');
                }
                // Atualizar o documento principal com contagem de chunks
                await db.collection(collection).doc(docId).set({ hasFile: true, fileChunks: totalChunks }, { merge: true });
                console.log('Arquivo salvo com sucesso:', totalChunks, 'chunks');
            } catch (e) { console.error('Erro ao salvar chunks no Firestore:', e); }
        }
        return true;
    },

    async _loadFileFromFirestore(collection, docId) {
        try {
            // Buscar chunks diretamente pelo ID (mais confiavel, sem necessidade de indice)
            let fileData = '';
            let fileName = '';
            let fileType = '';
            let chunkIdx = 0;
            let maxChunks = 50; // seguranca
            while (chunkIdx < maxChunks) {
                const chunkDoc = await db.collection(collection + '_files').doc(docId + '_chunk_' + chunkIdx).get();
                if (!chunkDoc.exists) break;
                const d = chunkDoc.data();
                fileData += d.data || '';
                if (d.fileName) fileName = d.fileName;
                if (d.fileType) fileType = d.fileType;
                chunkIdx++;
            }
            if (chunkIdx === 0) {
                // Fallback: tentar query where
                try {
                    const snap = await db.collection(collection + '_files').where('parentId', '==', docId).get();
                    if (!snap.empty) {
                        const chunks = snap.docs.map(d2 => d2.data()).sort((a, b) => a.chunkIndex - b.chunkIndex);
                        chunks.forEach(c => {
                            fileData += c.data || '';
                            if (c.fileName) fileName = c.fileName;
                            if (c.fileType) fileType = c.fileType;
                        });
                    }
                } catch(e2) { console.warn('Fallback query tambem falhou:', e2); }
            }
            if (!fileData) {
                console.warn('Nenhum chunk encontrado para', collection, docId);
                return null;
            }
            console.log('Arquivo carregado:', collection, docId, 'chunks:', chunkIdx || 'via query', 'tamanho:', fileData.length);
            return { fileData, fileName, fileType };
        } catch(e) { console.error('Erro ao carregar arquivo:', e); return null; }
    },

    async addReport(report) {
        report.id = 'rep' + Date.now();
        report.createdAt = new Date().toISOString();
        this._cache.reports.push(report);
        this._syncToLS('reports');
        console.log('Salvando relatorio no Firestore:', report.id, 'patientId:', report.patientId, 'hasFile:', !!report.fileData);
        const result = await this._saveToFirestoreWithFallback('reports', report.id, report, 'set');
        console.log('Resultado do save:', result);
        if (result === false) {
            console.error('ERRO: Relatorio NAO foi salvo no Firestore!');
            // Tentar salvar diretamente sem o arquivo
            try {
                const simple = { ...report };
                delete simple.fileData;
                await db.collection('reports').doc(report.id).set(simple);
                console.log('Relatorio salvo no Firestore (sem arquivo)');
            } catch(e2) { console.error('Falha total ao salvar relatorio:', e2); }
        }
        this._auditLog('create', 'report', 'Relatorio criado: ' + (report.type || '') + ' - ' + (report.patientId || ''));
        return report;
    },

    async removeReport(id) {
        this._cache.reports = this._cache.reports.filter(r => r.id !== id);
        this._syncToLS('reports');
        try {
            await db.collection('reports').doc(id).delete();
        } catch (e) { console.error(e); }
    },

    async updateReport(id, data) {
        const idx = this._cache.reports.findIndex(r => r.id === id);
        if (idx !== -1) {
            this._cache.reports[idx] = { ...this._cache.reports[idx], ...data };
            this._syncToLS('reports');
            await this._saveToFirestoreWithFallback('reports', id, data, 'update');
        }
    },

    // ====== USUARIOS - TROCA DE SENHA ======
    async changePassword(userId, newPassword) {
        const idx = this._cache.users.findIndex(u => u.id === userId);
        if (idx !== -1) {
            this._cache.users[idx].password = newPassword;
            this._syncToLS('users');
            try {
                // Usar set com merge para funcionar mesmo se doc não existir
                await db.collection('users').doc(userId).set({ password: newPassword }, { merge: true });
            } catch (e) { console.error('Erro ao salvar senha:', e); }
            return true;
        }
        return false;
    },

    async updateUser(id, data) {
        const idx = this._cache.users.findIndex(u => u.id === id);
        if (idx !== -1) {
            this._cache.users[idx] = { ...this._cache.users[idx], ...data };
            this._syncToLS('users');
            try {
                await db.collection('users').doc(id).set(data, { merge: true });
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
        this._syncToLS('abaTargets');
        try { await db.collection('abaTargets').doc(target.id).set(target); } catch (e) { console.error(e); }
        return target;
    },

    async updateAbaTarget(id, data) {
        const idx = this._cache.abaTargets.findIndex(t => t.id === id);
        if (idx !== -1) {
            this._cache.abaTargets[idx] = { ...this._cache.abaTargets[idx], ...data };
            this._syncToLS('abaTargets');
            try { await db.collection('abaTargets').doc(id).set(data, { merge: true }); } catch (e) { console.error(e); }
        }
    },

    async removeAbaTarget(id) {
        this._cache.abaTargets = this._cache.abaTargets.filter(t => t.id !== id);
        this._cache.abaSessions = this._cache.abaSessions.filter(s => s.targetId !== id);
        this._syncToLS('abaTargets');
        this._syncToLS('abaSessions');
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
        this._syncToLS('abaSessions');
        try { await db.collection('abaSessions').doc(session.id).set(session); } catch (e) { console.error(e); }
        return session;
    },

    async removeAbaSession(id) {
        this._cache.abaSessions = this._cache.abaSessions.filter(s => s.id !== id);
        this._syncToLS('abaSessions');
        try { await db.collection('abaSessions').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== AGENDA ======
    // Slot: { patientId, therapistId, date, startTime, endTime, shift (manha/tarde), status (agendado/confirmado/cancelado/realizado), notes }
    getAgenda() { return this._cache.agenda; },

    getAgendaByDate(date) {
        return this._cache.agenda.filter(a => a.date === date)
            .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
    },

    getAgendaByTherapist(therapistId) {
        return this._cache.agenda.filter(a => a.therapistId === therapistId)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
    },

    getAgendaByPatient(patientId) {
        return this._cache.agenda.filter(a => a.patientId === patientId)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
    },

    getAgendaByDateRange(startDate, endDate) {
        return this._cache.agenda.filter(a => a.date >= startDate && a.date <= endDate)
            .sort((a, b) => a.date.localeCompare(b.date) || (a.startTime || '').localeCompare(b.startTime || ''));
    },

    async addAgendaSlot(slot) {
        slot.id = 'agd' + Date.now();
        slot.createdAt = new Date().toISOString();
        slot.status = slot.status || 'agendado';
        this._cache.agenda.push(slot);
        this._syncToLS('agenda');
        try { await db.collection('agenda').doc(slot.id).set(slot); } catch (e) { console.error(e); }
        return slot;
    },

    async updateAgendaSlot(id, data) {
        const idx = this._cache.agenda.findIndex(a => a.id === id);
        if (idx !== -1) {
            this._cache.agenda[idx] = { ...this._cache.agenda[idx], ...data };
            this._syncToLS('agenda');
            // Usar set com merge para criar o doc caso não exista no Firestore
            const merged = { ...this._cache.agenda[idx] };
            try { await db.collection('agenda').doc(id).set(merged); } catch (e) { console.error('Erro ao salvar agenda:', e); }
        } else {
            console.warn('updateAgendaSlot: slot não encontrado no cache, id:', id);
        }
    },

    async removeAgendaSlot(id) {
        this._cache.agenda = this._cache.agenda.filter(a => a.id !== id);
        this._syncToLS('agenda');
        try { await db.collection('agenda').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== FREQUENCIA / ATTENDANCE ======
    // { patientId, therapistId, agendaSlotId, date, status (presente/falta/atraso/justificada), notes }
    getAttendance() { return this._cache.attendance; },

    getAttendanceByPatient(patientId) {
        return this._cache.attendance.filter(a => a.patientId === patientId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getAttendanceByTherapist(therapistId) {
        return this._cache.attendance.filter(a => a.therapistId === therapistId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getAttendanceByMonth(year, month) {
        const prefix = `${year}-${String(month).padStart(2, '0')}`;
        return this._cache.attendance.filter(a => a.date && a.date.startsWith(prefix));
    },

    async addAttendance(record) {
        record.id = 'att' + Date.now();
        record.createdAt = new Date().toISOString();
        this._cache.attendance.push(record);
        this._syncToLS('attendance');
        try { await db.collection('attendance').doc(record.id).set(record); } catch (e) { console.error(e); }
        return record;
    },

    async updateAttendance(id, data) {
        const idx = this._cache.attendance.findIndex(a => a.id === id);
        if (idx !== -1) {
            this._cache.attendance[idx] = { ...this._cache.attendance[idx], ...data };
            this._syncToLS('attendance');
            try { await db.collection('attendance').doc(id).set(data, { merge: true }); } catch (e) { console.error(e); }
        }
    },

    async removeAttendance(id) {
        this._cache.attendance = this._cache.attendance.filter(a => a.id !== id);
        this._syncToLS('attendance');
        try { await db.collection('attendance').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== PAGAMENTOS ======
    // { patientId, month (YYYY-MM), amount, status (pendente/pago/parcial), paymentDate, method, notes }
    getPayments() { return this._cache.payments; },

    getPaymentsByPatient(patientId) {
        return this._cache.payments.filter(p => p.patientId === patientId)
            .sort((a, b) => (b.month || '').localeCompare(a.month || ''));
    },

    getPaymentsByMonth(yearMonth) {
        return this._cache.payments.filter(p => p.month === yearMonth);
    },

    async addPayment(payment) {
        payment.id = 'pay' + Date.now();
        payment.createdAt = new Date().toISOString();
        this._cache.payments.push(payment);
        this._syncToLS('payments');
        try { await db.collection('payments').doc(payment.id).set(payment); } catch (e) { console.error(e); }
        return payment;
    },

    async updatePayment(id, data) {
        const idx = this._cache.payments.findIndex(p => p.id === id);
        if (idx !== -1) {
            this._cache.payments[idx] = { ...this._cache.payments[idx], ...data };
            this._syncToLS('payments');
            try { await db.collection('payments').doc(id).set(data, { merge: true }); } catch (e) { console.error(e); }
        }
    },

    async removePayment(id) {
        this._cache.payments = this._cache.payments.filter(p => p.id !== id);
        this._syncToLS('payments');
        try { await db.collection('payments').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== ESPELHOS (STATEMENTS) ======
    // { patientId, type (mensal/anual), period (YYYY-MM ou YYYY), totalSessions, attendedSessions, missedSessions, totalAmount, paidAmount, notes, generatedAt }
    getStatements() { return this._cache.statements; },

    getStatementsByPatient(patientId) {
        return this._cache.statements.filter(s => s.patientId === patientId)
            .sort((a, b) => (b.period || '').localeCompare(a.period || ''));
    },

    getStatementsByPeriod(period) {
        return this._cache.statements.filter(s => s.period === period);
    },

    async addStatement(statement) {
        statement.id = 'stm' + Date.now();
        statement.createdAt = new Date().toISOString();
        statement.generatedAt = new Date().toISOString();
        this._cache.statements.push(statement);
        this._syncToLS('statements');
        try { await db.collection('statements').doc(statement.id).set(statement); } catch (e) { console.error(e); }
        return statement;
    },

    async updateStatement(id, data) {
        const idx = this._cache.statements.findIndex(s => s.id === id);
        if (idx !== -1) {
            this._cache.statements[idx] = { ...this._cache.statements[idx], ...data };
            this._syncToLS('statements');
            try { await db.collection('statements').doc(id).set(data, { merge: true }); } catch (e) { console.error(e); }
        }
    },

    async removeStatement(id) {
        this._cache.statements = this._cache.statements.filter(s => s.id !== id);
        this._syncToLS('statements');
        try { await db.collection('statements').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== SOLICITACOES DE RELATORIO ======
    // { patientId, requestedBy (userId), type, notes, status (pendente/em_andamento/concluido), createdAt, resolvedAt }
    getReportRequests() { return this._cache.reportRequests; },

    getReportRequestsByPatient(patientId) {
        return this._cache.reportRequests.filter(r => r.patientId === patientId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getReportRequestsByStatus(status) {
        return this._cache.reportRequests.filter(r => r.status === status);
    },

    getPendingReportRequests() {
        return this._cache.reportRequests.filter(r => r.status === 'pendente' || r.status === 'em_andamento');
    },

    async addReportRequest(request) {
        request.id = 'rr' + Date.now();
        request.createdAt = new Date().toISOString();
        request.status = request.status || 'pendente';
        this._cache.reportRequests.push(request);
        this._syncToLS('reportRequests');
        try { await db.collection('reportRequests').doc(request.id).set(request); } catch (e) { console.error(e); }
        // Criar notificacao para coordenacao
        const patient = this.getPatientById(request.patientId);
        await this.addNotification({
            type: 'report_request',
            title: 'Nova Solicitação de Relatório',
            message: `Paciente ${patient ? patient.name : 'N/A'} solicitou relatório: ${request.type || 'Geral'}`,
            targetRole: 'coordenacao',
            relatedId: request.id
        });
        return request;
    },

    async updateReportRequest(id, data) {
        const idx = this._cache.reportRequests.findIndex(r => r.id === id);
        if (idx !== -1) {
            this._cache.reportRequests[idx] = { ...this._cache.reportRequests[idx], ...data };
            this._syncToLS('reportRequests');
            // Se tem arquivo, usar chunked storage
            if (data.fileData) {
                await this._saveToFirestoreWithFallback('reportRequests', id, data, 'update');
            } else {
                try { await db.collection('reportRequests').doc(id).set(data, { merge: true }); } catch (e) { console.error(e); }
            }
        }
    },

    // ====== NOTIFICACOES ======
    // { type, title, message, targetRole (coordenacao/terapeuta/adm/paciente), targetUserId (opcional), read, relatedId }
    getNotifications() { return this._cache.notifications; },

    getNotificationsByRole(role) {
        return this._cache.notifications.filter(n => n.targetRole === role && !n.read)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getNotificationsByUser(userId) {
        return this._cache.notifications.filter(n => n.targetUserId === userId && !n.read)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getUnreadNotificationCount(role, userId) {
        return this._cache.notifications.filter(n =>
            !n.read && (n.targetRole === role || n.targetUserId === userId)
        ).length;
    },

    async addNotification(notification) {
        notification.id = 'notif' + Date.now();
        notification.createdAt = new Date().toISOString();
        notification.read = false;
        this._cache.notifications.push(notification);
        this._syncToLS('notifications');
        try { await db.collection('notifications').doc(notification.id).set(notification); } catch (e) { console.error(e); }
        return notification;
    },

    async markNotificationRead(id) {
        const idx = this._cache.notifications.findIndex(n => n.id === id);
        if (idx !== -1) {
            this._cache.notifications[idx].read = true;
            this._syncToLS('notifications');
            try { await db.collection('notifications').doc(id).set({ read: true }, { merge: true }); } catch (e) { console.error(e); }
        }
    },

    async markAllNotificationsRead(role, userId) {
        for (const n of this._cache.notifications) {
            if (!n.read && (n.targetRole === role || n.targetUserId === userId)) {
                n.read = true;
                try { await db.collection('notifications').doc(n.id).set({ read: true }, { merge: true }); } catch (e) { console.error(e); }
            }
        }
    },

    // ====== OBJETIVOS TERAPEUTICOS ======
    // { patientId, therapistId (quem criou), type (individual/multiprofissional), title, description, status (ativo/atingido/pausado), startDate, targetDate, notes }
    getTherapeuticObjectives() { return this._cache.therapeuticObjectives; },

    getObjectivesByPatient(patientId) {
        return this._cache.therapeuticObjectives.filter(o => o.patientId === patientId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getObjectivesByTherapist(therapistId) {
        return this._cache.therapeuticObjectives.filter(o => o.therapistId === therapistId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getObjectivesByType(type) {
        return this._cache.therapeuticObjectives.filter(o => o.type === type);
    },

    async addTherapeuticObjective(objective) {
        objective.id = 'obj' + Date.now();
        objective.createdAt = new Date().toISOString();
        objective.status = objective.status || 'ativo';
        this._cache.therapeuticObjectives.push(objective);
        this._syncToLS('therapeuticObjectives');
        try { await db.collection('therapeuticObjectives').doc(objective.id).set(objective); } catch (e) { console.error(e); }
        return objective;
    },

    async updateTherapeuticObjective(id, data) {
        const idx = this._cache.therapeuticObjectives.findIndex(o => o.id === id);
        if (idx !== -1) {
            this._cache.therapeuticObjectives[idx] = { ...this._cache.therapeuticObjectives[idx], ...data };
            this._syncToLS('therapeuticObjectives');
            try { await db.collection('therapeuticObjectives').doc(id).set(data, { merge: true }); } catch (e) { console.error(e); }
        }
    },

    async removeTherapeuticObjective(id) {
        this._cache.therapeuticObjectives = this._cache.therapeuticObjectives.filter(o => o.id !== id);
        this._syncToLS('therapeuticObjectives');
        try { await db.collection('therapeuticObjectives').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== DEVOLUTIVAS ======
    // { patientId, type (familia/escola), date, time, participants, therapistIds, notes, status (agendada/realizada/cancelada) }
    getDevolutivas() { return this._cache.devolutivas; },

    getDevolutivasByPatient(patientId) {
        return this._cache.devolutivas.filter(d => d.patientId === patientId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getDevolutivasByDate(date) {
        return this._cache.devolutivas.filter(d => d.date === date);
    },

    getUpcomingDevolutivas() {
        const today = new Date().toISOString().split('T')[0];
        return this._cache.devolutivas.filter(d => d.date >= today && d.status !== 'cancelada')
            .sort((a, b) => a.date.localeCompare(b.date));
    },

    async addDevolutiva(devolutiva) {
        devolutiva.id = 'dev' + Date.now();
        devolutiva.createdAt = new Date().toISOString();
        devolutiva.status = devolutiva.status || 'agendada';
        this._cache.devolutivas.push(devolutiva);
        this._syncToLS('devolutivas');
        try { await db.collection('devolutivas').doc(devolutiva.id).set(devolutiva); } catch (e) { console.error(e); }
        this._auditLog('create', 'devolutiva', 'Devolutiva agendada: ' + (devolutiva.patientId || ''));
        return devolutiva;
    },

    async updateDevolutiva(id, data) {
        const idx = this._cache.devolutivas.findIndex(d => d.id === id);
        if (idx !== -1) {
            this._cache.devolutivas[idx] = { ...this._cache.devolutivas[idx], ...data };
            this._syncToLS('devolutivas');
            try { await db.collection('devolutivas').doc(id).set(data, { merge: true }); } catch (e) { console.error(e); }
            this._auditLog('update', 'devolutiva', 'Devolutiva atualizada: ' + id);
        }
    },

    async removeDevolutiva(id) {
        this._cache.devolutivas = this._cache.devolutivas.filter(d => d.id !== id);
        this._syncToLS('devolutivas');
        try { await db.collection('devolutivas').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== DOCUMENTOS (TERAPEUTA) ======
    // { therapistId, type (certificado/crp/contrato/diploma/outro), title, fileName, fileData (base64), uploadedAt }
    getDocuments() { return this._cache.documents; },

    getDocumentsByTherapist(therapistId) {
        return this._cache.documents.filter(d => d.therapistId === therapistId)
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    },

    async addDocument(doc) {
        doc.id = 'doc' + Date.now();
        doc.uploadedAt = new Date().toISOString();
        this._cache.documents.push(doc);
        this._syncToLS('documents');
        try { await db.collection('documents').doc(doc.id).set(doc); } catch (e) { console.error(e); }
        return doc;
    },

    async removeDocument(id) {
        this._cache.documents = this._cache.documents.filter(d => d.id !== id);
        this._syncToLS('documents');
        try { await db.collection('documents').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== ATENDIMENTOS COM FAMILIA ======
    // { patientId, date, time, type (presencial/online), location, therapistIds[], familyContacts [{name, email, phone}],
    //   agenda, notes, status (agendada/confirmada/realizada/cancelada), inviteSent, createdBy }
    getFamilyMeetings() { return this._cache.familyMeetings; },

    getFamilyMeetingsByPatient(patientId) {
        return this._cache.familyMeetings.filter(m => m.patientId === patientId)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    getFamilyMeetingsByDate(date) {
        return this._cache.familyMeetings.filter(m => m.date === date);
    },

    getUpcomingFamilyMeetings() {
        const today = new Date().toISOString().split('T')[0];
        return this._cache.familyMeetings.filter(m => m.date >= today && m.status !== 'cancelada')
            .sort((a, b) => a.date.localeCompare(b.date));
    },

    async addFamilyMeeting(meeting) {
        meeting.id = 'fm' + Date.now();
        meeting.createdAt = new Date().toISOString();
        meeting.status = meeting.status || 'agendada';
        meeting.inviteSent = meeting.inviteSent || false;
        this._cache.familyMeetings.push(meeting);
        this._syncToLS('familyMeetings');
        try { await db.collection('familyMeetings').doc(meeting.id).set(meeting); } catch (e) { console.error(e); }
        return meeting;
    },

    async updateFamilyMeeting(id, data) {
        const idx = this._cache.familyMeetings.findIndex(m => m.id === id);
        if (idx !== -1) {
            this._cache.familyMeetings[idx] = { ...this._cache.familyMeetings[idx], ...data };
            this._syncToLS('familyMeetings');
            try { await db.collection('familyMeetings').doc(id).set(data, { merge: true }); } catch (e) { console.error(e); }
        }
    },

    async removeFamilyMeeting(id) {
        this._cache.familyMeetings = this._cache.familyMeetings.filter(m => m.id !== id);
        this._syncToLS('familyMeetings');
        try { await db.collection('familyMeetings').doc(id).delete(); } catch (e) { console.error(e); }
    },

    // ====== REAVALIACOES PROGRAMADAS ======
    getReassessments() { return this._cache.reassessments; },

    getReassessmentsByPatient(patientId) {
        return this._cache.reassessments.filter(r => r.patientId === patientId)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    },

    getUpcomingReassessments(days) {
        const today = new Date();
        const limit = new Date();
        limit.setDate(limit.getDate() + (days || 30));
        return this._cache.reassessments.filter(r => {
            if (r.status === 'concluida') return false;
            const due = new Date(r.dueDate);
            return due >= today && due <= limit;
        }).sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    },

    getOverdueReassessments() {
        const today = new Date().toISOString().split('T')[0];
        return this._cache.reassessments.filter(r => r.status !== 'concluida' && r.dueDate < today)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    },

    async addReassessment(r) {
        r.id = 'reav' + Date.now();
        r.createdAt = new Date().toISOString();
        r.status = r.status || 'pendente';
        this._cache.reassessments.push(r);
        this._syncToLS('reassessments');
        try { await db.collection('reassessments').doc(r.id).set(r); } catch(e) { console.error(e); }
        this._auditLog('Criou reavaliacao', r.patientId, r.type);
        return r;
    },

    async updateReassessment(id, data) {
        const idx = this._cache.reassessments.findIndex(r => r.id === id);
        if (idx !== -1) {
            this._cache.reassessments[idx] = { ...this._cache.reassessments[idx], ...data };
            this._syncToLS('reassessments');
            try { await db.collection('reassessments').doc(id).set(data, { merge: true }); } catch(e) { console.error(e); }
        }
    },

    async removeReassessment(id) {
        this._cache.reassessments = this._cache.reassessments.filter(r => r.id !== id);
        this._syncToLS('reassessments');
        try { await db.collection('reassessments').doc(id).delete(); } catch(e) { console.error(e); }
    },

    // ====== EVOLUCOES - SCOPE HELPERS ======
    // scope: 'individual' (default, so terapeuta que criou ve) ou 'multiprofissional' (todos terapeutas do caso veem)
    getEvolutionsByPatientAndScope(patientId, scope, therapistId) {
        return this._cache.evolutions.filter(e => {
            if (e.patientId !== patientId) return false;
            const evoScope = e.scope || 'individual';
            if (scope === 'individual') {
                return evoScope === 'individual' && e.therapistId === therapistId;
            } else {
                return evoScope === 'multiprofissional';
            }
        }).sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    // ====== DOCUMENTOS POR PACIENTE ======
    getDocumentsByPatient(patientId) {
        return this._cache.documents.filter(d => d.patientId === patientId)
            .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    },

    // ====== PERSISTENCIA localStorage ======
    _syncToLS(collectionName) {
        try {
            localStorage.setItem('prisma_' + collectionName, JSON.stringify(this._cache[collectionName]));
        } catch(e) { console.error('Erro ao salvar localStorage:', e); }
    },

    _syncAllToLS() {
        const collections = ['users', 'patients', 'evolutions', 'reports', 'abaTargets', 'abaSessions',
            'agenda', 'attendance', 'payments', 'statements', 'reportRequests',
            'notifications', 'therapeuticObjectives', 'devolutivas', 'documents', 'familyMeetings', 'messages', 'reassessments'];
        collections.forEach(name => this._syncToLS(name));
    },

    // ====== EXPORT / IMPORT ======
    exportAllData() {
        const data = {};
        for (const key in this._cache) {
            data[key] = this._cache[key];
        }
        data.exportedAt = new Date().toISOString();
        data.version = '3.0';
        return data;
    },

    async importAllData(data) {
        if (!data || !data.version) throw new Error('Dados invalidos');
        const collections = ['users', 'patients', 'evolutions', 'reports', 'abaTargets', 'abaSessions',
            'agenda', 'attendance', 'payments', 'statements', 'reportRequests',
            'notifications', 'therapeuticObjectives', 'devolutivas', 'documents', 'familyMeetings', 'messages', 'reassessments'];
        for (const name of collections) {
            if (data[name] && Array.isArray(data[name])) {
                this._cache[name] = data[name];
                this._syncToLS(name);
                // Sync to Firestore
                for (const item of data[name]) {
                    try { await db.collection(name).doc(item.id).set(item); } catch(e) { console.error(e); }
                }
            }
        }
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
            evolutionsThisMonth: evolutions.filter(e => e.date && e.date.startsWith(thisMonth)).length,
            pendingReportRequests: this.getPendingReportRequests().length,
            upcomingDevolutivas: this.getUpcomingDevolutivas().length
        };
    },

    // ====== TEMPLATES DE RELATORIO ======
    getReportTemplates() {
        return [
            {
                id: 'tpl_mensal', name: 'Relatorio Mensal', type: 'mensal',
                content: `RELATORIO MENSAL DE ACOMPANHAMENTO TERAPEUTICO\n\nPACIENTE: [nome do paciente]\nPERIODO: [mes/ano]\nTERAPEUTA: [nome do terapeuta]\nESPECIALIDADE: [especialidade]\n\n1. OBJETIVOS TRABALHADOS NO PERIODO\n- \n\n2. PROCEDIMENTOS E ESTRATEGIAS UTILIZADAS\n- \n\n3. RESULTADOS OBSERVADOS\n- Habilidades adquiridas:\n- Habilidades em desenvolvimento:\n- Dificuldades persistentes:\n\n4. COMPORTAMENTOS RELEVANTES\n- Comportamentos adequados:\n- Comportamentos inadequados (frequencia, intensidade, duracao):\n\n5. ORIENTACOES PARA A FAMILIA\n- \n\n6. PLANO PARA O PROXIMO PERIODO\n- Manter:\n- Modificar:\n- Introduzir:\n\n7. CONSIDERACOES FINAIS\n\n_______________________________\n[nome do terapeuta]\n[CRP/registro]`
            },
            {
                id: 'tpl_semestral', name: 'Relatorio Semestral', type: 'semestral',
                content: `RELATORIO SEMESTRAL DE EVOLUCAO TERAPEUTICA\n\nPACIENTE: [nome do paciente]\nPERIODO: [semestre/ano]\nTERAPEUTA: [nome do terapeuta]\n\n1. DADOS DE IDENTIFICACAO\n- Nome:\n- Idade:\n- Diagnostico:\n- Inicio do acompanhamento:\n\n2. OBJETIVOS DO PLANO TERAPEUTICO\n2.1 Objetivos atingidos:\n2.2 Objetivos em andamento:\n2.3 Objetivos reformulados:\n\n3. EVOLUCAO POR AREA\n3.1 Comunicacao e Linguagem:\n3.2 Interacao Social:\n3.3 Comportamento:\n3.4 Autonomia/AVDs:\n3.5 Cognitivo/Academico:\n3.6 Motor:\n\n4. ANALISE COMPARATIVA (ANTES x AGORA)\n- Linha de base inicial:\n- Status atual:\n\n5. INSTRUMENTOS E ESCALAS UTILIZADOS\n- \n\n6. FREQUENCIA E ENGAJAMENTO\n- Total de sessoes previstas:\n- Sessoes realizadas:\n- Faltas:\n- Taxa de presenca:\n\n7. RECOMENDACOES\n- Para a familia:\n- Para a escola:\n- Para a equipe:\n\n8. PLANO PARA O PROXIMO SEMESTRE\n\n_______________________________\n[nome do terapeuta]`
            },
            {
                id: 'tpl_escolar', name: 'Relatorio Escolar', type: 'escolar',
                content: `RELATORIO DE ACOMPANHAMENTO ESCOLAR\n\nPACIENTE: [nome do paciente]\nESCOLA: [nome da escola]\nTURMA/SERIE: [turma]\nPERIODO: [periodo]\nTERAPEUTA: [nome do terapeuta]\n\n1. DESEMPENHO ACADEMICO\n- Areas de facilidade:\n- Areas de dificuldade:\n- Necessidade de adaptacao curricular:\n\n2. INTERACAO NO AMBIENTE ESCOLAR\n- Com colegas:\n- Com professores:\n- Em atividades em grupo:\n- No recreio/intervalo:\n\n3. COMPORTAMENTO EM SALA\n- Atencao e concentracao:\n- Seguir instrucoes:\n- Organizacao:\n- Autonomia nas tarefas:\n\n4. SUPORTE NECESSARIO\n- Adaptacoes pedagogicas:\n- Mediacao:\n- Recursos visuais:\n- Flexibilizacao de avaliacoes:\n\n5. ORIENTACOES PARA A EQUIPE ESCOLAR\n- \n\n6. METAS PARA O PROXIMO PERIODO\n- \n\n_______________________________\n[nome do terapeuta]`
            },
            {
                id: 'tpl_alta', name: 'Relatorio de Alta', type: 'alta',
                content: `RELATORIO DE ALTA TERAPEUTICA\n\nPACIENTE: [nome do paciente]\nDATA DE INICIO: [data]\nDATA DE ALTA: [data]\nTERAPEUTA: [nome do terapeuta]\n\n1. MOTIVO DA ALTA\n( ) Alta terapeutica - objetivos atingidos\n( ) Alta a pedido da familia\n( ) Encaminhamento para outro servico\n( ) Outro: _______________\n\n2. RESUMO DO ACOMPANHAMENTO\n- Duracao total:\n- Total de sessoes:\n- Abordagem utilizada:\n\n3. OBJETIVOS INICIAIS E RESULTADOS\n3.1 Objetivo 1: [STATUS]\n3.2 Objetivo 2: [STATUS]\n3.3 Objetivo 3: [STATUS]\n\n4. EVOLUCAO GERAL\n- \n\n5. RECOMENDACOES POS-ALTA\n- Para a familia:\n- Para a escola:\n- Necessidade de acompanhamento futuro:\n\n6. ENCAMINHAMENTOS\n- \n\n_______________________________\n[nome do terapeuta]`
            },
            {
                id: 'tpl_devolutiva', name: 'Devolutiva para Familia', type: 'devolutiva',
                content: `DEVOLUTIVA TERAPEUTICA PARA A FAMILIA\n\nPACIENTE: [nome do paciente]\nDATA: [data]\nPARTICIPANTES: [nomes]\nTERAPEUTA: [nome do terapeuta]\nSUPERVISOR: [nome]\n\n1. RESUMO DA EVOLUCAO ATUAL\n- \n\n2. PONTOS FORTES OBSERVADOS\n- \n\n3. AREAS QUE NECESSITAM DE ATENCAO\n- \n\n4. ORIENTACOES PARA CASA\n4.1 Rotina:\n4.2 Comunicacao:\n4.3 Comportamento:\n4.4 Autonomia:\n\n5. ESTRATEGIAS RECOMENDADAS\n- \n\n6. PROXIMOS PASSOS\n- \n\n_______________________________\n[nome do terapeuta]`
            }
        ];
    },

    getTemplateByType(type) {
        return this.getReportTemplates().find(t => t.type === type);
    },

    // ====== MENSAGENS INTERNAS ======
    getMessages() { return this._cache.messages; },

    getMessagesByUser(userId) {
        return this._cache.messages.filter(m => m.toId === userId || m.fromId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    },

    getUnreadMessages(userId) {
        return this._cache.messages.filter(m => m.toId === userId && !m.read);
    },

    async addMessage(msg) {
        msg.id = 'msg' + Date.now();
        msg.createdAt = new Date().toISOString();
        msg.read = false;
        this._cache.messages.push(msg);
        this._syncToLS('messages');
        try { await db.collection('messages').doc(msg.id).set(msg); } catch(e) { console.error(e); }
        return msg;
    },

    async markMessageRead(id) {
        const idx = this._cache.messages.findIndex(m => m.id === id);
        if (idx !== -1) {
            this._cache.messages[idx].read = true;
            this._syncToLS('messages');
            try { await db.collection('messages').doc(id).set({ read: true }, { merge: true }); } catch(e) { console.error(e); }
        }
    },

    async markAllMessagesRead(userId) {
        this._cache.messages.forEach(m => {
            if (m.toId === userId && !m.read) m.read = true;
        });
        this._syncToLS('messages');
        const unread = this._cache.messages.filter(m => m.toId === userId);
        for (const m of unread) {
            try { await db.collection('messages').doc(m.id).set({ read: true }, { merge: true }); } catch(e) {}
        }
    }
};

// ====== UTILIDADES GLOBAIS ======
function validatePhone(phone) {
    if (!phone) return true;
    const clean = phone.replace(/\D/g, '');
    return clean.length >= 10 && clean.length <= 11;
}

function validateEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatPhone(input) {
    let v = input.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);
    if (v.length > 6) v = '(' + v.slice(0,2) + ') ' + v.slice(2,7) + '-' + v.slice(7);
    else if (v.length > 2) v = '(' + v.slice(0,2) + ') ' + v.slice(2);
    input.value = v;
}

function setLoadingBtn(btn, loading) {
    if (loading) {
        btn.classList.add('loading');
        btn.disabled = true;
    } else {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}
