import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
        import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
        import { getFirestore, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

        const app = initializeApp({ apiKey: "AIzaSyCzcxTLAUH83sQsia4dPg5py19YzRsmw0o", authDomain: "remagstyle-43b41.firebaseapp.com", projectId: "remagstyle-43b41", messagingSenderId: "145831201308", appId: "1:145831201308:web:489a014516356f73a72dd9" });
        const auth = getAuth(app);
        const db = getFirestore(app);
        const draft = JSON.parse(sessionStorage.getItem('remagstyle-order-draft') || 'null');
        const intro = document.getElementById('measurement-intro');
        const fields = document.getElementById('measurement-fields');
        const form = document.getElementById('measurements-form');
        const message = document.getElementById('measurement-message');
        const submitOrderButton = document.getElementById('submit-order-btn');
        const nextMeasurementButton = document.getElementById('measurement-next-btn');
        const stageTitle = document.getElementById('measurement-stage-title');
        const measurementSets = {
            Trousers: [
                ['waist', 'Waist'],
                ['hip', 'Hip'],
                ['waistToHip', 'Waist to hip'],
                ['trouserLength', 'Trouser length'],
                ['hemlines', 'Hemlines'],
                ['thigh', 'Thigh'],
                ['knee', 'Knee'],
                ['crotchLength', 'Crotch length'],
                ['crotchDepth', 'Crotch depth'],
                ['waistToKnee', 'Waist to knee']
            ],
            'Shirts (Long & Short)': [
                ['chest', 'Chest'],
                ['acrossShoulder', 'Across to shoulder'],
                ['acrossBack', 'Across to back'],
                ['acrossChest', 'Across to chest'],
                ['shirtLength', 'Shirt length'],
                ['aroundArm', 'Around arm'],
                ['aroundElbow', 'Around elbow'],
                ['aroundWaist', 'Around waist'],
                ['sleeveLength', 'Sleeve length']
            ],
            'Kaftan/Agbada': [
                ['waist', 'Waist'],
                ['hip', 'Hip'],
                ['waistToHip', 'Waist to hip'],
                ['trouserLength', 'Trouser length'],
                ['hemlines', 'Hemlines'],
                ['thigh', 'Thigh'],
                ['knee', 'Knee'],
                ['crotchLength', 'Crotch length'],
                ['crotchDepth', 'Crotch depth'],
                ['waistToKnee', 'Waist to knee'],
                ['chest', 'Chest'],
                ['acrossShoulder', 'Across to shoulder'],
                ['acrossBack', 'Across to back'],
                ['acrossChest', 'Across to chest'],
                ['shirtLength', 'Shirt length'],
                ['aroundArm', 'Around arm'],
                ['aroundElbow', 'Around elbow'],
                ['aroundWaist', 'Around waist'],
                ['sleeveLength', 'Sleeve length']
            ],
            Suits: [
                ['waistToKnee', 'Waist to knee'],
                ['shoulder', 'Shoulder'],
                ['elbow', 'Elbow'],
                ['sleeve', 'Sleeve'],
                ['chest', 'Chest'],
                ['suitLength', 'Suit length']
            ],
            'Red Carpet Dresses': [
                ['bust', 'Bust'],
                ['waist', 'Waist'],
                ['hip', 'Hip'],
                ['shoulder', 'Shoulder'],
                ['acrossBack', 'Across Back'],
                ['acrossChest', 'Across Chest'],
                ['shoulderToNipple', 'Shoulder to Nipple'],
                ['nippleToNipple', 'Nipple to Nipple'],
                ['shoulderToUnderBust', 'Shoulder to Under Bust'],
                ['shoulderToWaist', 'Shoulder to Waist'],
                ['shoulderToHip', 'Shoulder to Hip'],
                ['napeToWaist', 'Nape to Waist'],
                ['blouseLength', 'Blouse Length'],
                ['kabaLength', 'Kaba Length'],
                ['hipDepth', 'Hip Depth'],
                ['skirtLength', 'Skirt Length'],
                ['sleeveLength', 'Sleeve Length'],
                ['slitLength', 'Slit Length'],
                ['aroundArm', 'Around Arm'],
                ['dressLength', 'Dress Length']
            ],
            'Prom Dress': [
                ['bust', 'Bust'],
                ['waist', 'Waist'],
                ['hip', 'Hip'],
                ['shoulder', 'Shoulder'],
                ['acrossBack', 'Across Back'],
                ['acrossChest', 'Across Chest'],
                ['shoulderToNipple', 'Shoulder to Nipple'],
                ['nippleToNipple', 'Nipple to Nipple'],
                ['shoulderToUnderBust', 'Shoulder to Under Bust'],
                ['shoulderToWaist', 'Shoulder to Waist'],
                ['shoulderToHip', 'Shoulder to Hip'],
                ['napeToWaist', 'Nape to Waist'],
                ['blouseLength', 'Blouse Length'],
                ['kabaLength', 'Kaba Length'],
                ['hipDepth', 'Hip Depth'],
                ['skirtLength', 'Skirt Length'],
                ['sleeveLength', 'Sleeve Length'],
                ['slitLength', 'Slit Length'],
                ['aroundArm', 'Around Arm'],
                ['dressLength', 'Dress Length']
            ],
            'Corset Dresses': [
                ['bust', 'Bust'],
                ['waist', 'Waist'],
                ['hip', 'Hip'],
                ['shoulder', 'Shoulder'],
                ['acrossBack', 'Across Back'],
                ['acrossChest', 'Across Chest'],
                ['shoulderToNipple', 'Shoulder to Nipple'],
                ['nippleToNipple', 'Nipple to Nipple'],
                ['shoulderToUnderBust', 'Shoulder to Under Bust'],
                ['shoulderToWaist', 'Shoulder to Waist'],
                ['shoulderToHip', 'Shoulder to Hip'],
                ['napeToWaist', 'Nape to Waist'],
                ['blouseLength', 'Blouse Length'],
                ['kabaLength', 'Kaba Length'],
                ['hipDepth', 'Hip Depth'],
                ['skirtLength', 'Skirt Length'],
                ['sleeveLength', 'Sleeve Length'],
                ['slitLength', 'Slit Length'],
                ['aroundArm', 'Around Arm'],
                ['dressLength', 'Dress Length']
            ],
            'Slit and Kaba': [
                ['bust', 'Bust'],
                ['waist', 'Waist'],
                ['hip', 'Hip'],
                ['shoulder', 'Shoulder'],
                ['acrossBack', 'Across Back'],
                ['acrossChest', 'Across Chest'],
                ['shoulderToNipple', 'Shoulder to Nipple'],
                ['nippleToNipple', 'Nipple to Nipple'],
                ['shoulderToUnderBust', 'Shoulder to Under Bust'],
                ['shoulderToWaist', 'Shoulder to Waist'],
                ['shoulderToHip', 'Shoulder to Hip'],
                ['napeToWaist', 'Nape to Waist'],
                ['blouseLength', 'Blouse Length'],
                ['kabaLength', 'Kaba Length'],
                ['hipDepth', 'Hip Depth'],
                ['skirtLength', 'Skirt Length'],
                ['sleeveLength', 'Sleeve Length'],
                ['slitLength', 'Slit Length'],
                ['aroundArm', 'Around Arm'],
                ['dressLength', 'Dress Length']
            ],
            'Bridal Couture': {
                vertical: [
                    ['height', 'Height'],
                    ['shoulderHighBust', 'Shoulder - High Bust'],
                    ['shoulderBustPoint', 'Shoulder - Bust Point'],
                    ['shoulderUnderBust', 'Shoulder - Under Bust'],
                    ['shoulderAbdominalWaist', 'Shoulder - Abdominal Waist'],
                    ['shoulderDropWaist', 'Shoulder - Drop Waist'],
                    ['shoulderHighHip', 'Shoulder - High Hip'],
                    ['shoulderHip', 'Shoulder - Hip'],
                    ['shoulderKnee', 'Shoulder - Knee'],
                    ['shoulderMidi', 'Shoulder - Midi'],
                    ['shoulderEvening', 'Shoulder - Evening'],
                    ['shoulderFloor', 'Shoulder - Floor (add minimum heel allowance)'],
                    ['waistKnee', 'Waist - Knee'],
                    ['waistMidi', 'Waist - Midi'],
                    ['waistFloor', 'Waist - Floor (add minimum heel allowance)'],
                    ['waistEvening', 'Waist - Evening'],
                    ['trainFloorDrop', 'Train Floor Drop'],
                    ['ballGownVolumeArch', 'Ball Gown Volume Arch'],
                    ['napeWaist', 'Nape Waist'],
                    ['backWaistUnderButtock', 'Back Waist - Under Buttock'],
                    ['backWaistBackKneeBreak', 'Back Waist - Back Knee Break'],
                    ['rise', 'Rise (around crotch to waist)'],
                    ['waistToCrotchLine', 'Waist to Crotch Line'],
                    ['insideLegToHeel', 'Inside Leg to Heel'],
                    ['sleeveLength', 'Sleeve Length'],
                    ['armySyceFront', 'Army Syce (Front)'],
                    ['armySyceBack', 'Army Syce (Back)'],
                    ['shoulderScapular', 'Shoulder - Scapular']
                ],
                horizontal: [
                    ['aroundHead', 'Around Head'],
                    ['aroundNeck', 'Around Neck'],
                    ['frontHighBust', 'Front High Bust'],
                    ['backHighBust', 'Back High Bust'],
                    ['shoulderShoulder', 'Shoulder - Shoulder'],
                    ['acrossBack', 'Across Back'],
                    ['nippleNipple', 'Nipple - Nipple'],
                    ['bust', 'Bust'],
                    ['frontBust', 'Front Bust'],
                    ['backBust', 'Back Bust'],
                    ['braletCup', 'Bralet Cup'],
                    ['braSize', 'Bra Size'],
                    ['underBust', 'Under Bust'],
                    ['naturalWaist', 'Natural Waist'],
                    ['abdominalWaist', 'Abdominal Waist'],
                    ['droppedWaist', 'Dropped Waist'],
                    ['highHip', 'High Hip'],
                    ['hip', 'Hip'],
                    ['frontHip', 'Front Hip'],
                    ['backHip', 'Back Hip'],
                    ['aroundUnderButtock', 'Around Under Buttock'],
                    ['aroundLegSkip', 'Around Leg Skip (Above Knee)'],
                    ['aroundThigh', 'Around Thigh'],
                    ['aroundKnee', 'Around Knee'],
                    ['aroundAnkle', 'Around Ankle'],
                    ['aroundCalf', 'Around Calf'],
                    ['aroundArm', 'Around Arm'],
                    ['aroundArmhole', 'Around Armhole'],
                    ['aroundKnuckle', 'Around Knuckle'],
                    ['wrist', 'Wrist'],
                    ['archCircumference', 'Arch Circumference'],
                    ['cupArch', 'Cup Arch']
                ]
            }
        };

        if (!draft?.garment || !measurementSets[draft.garment]) {
            intro.textContent = 'No order draft was found. Please return to the order form.';
            form.classList.add('hidden');
        } else {
            const isBridal = draft.garment === 'Bridal Couture';
            let currentStage = isBridal ? 'vertical' : 'standard';
            let measurementValues = draft.measurements || {};
            intro.textContent = `Measurements for ${draft.garment}. Enter each measurement in centimeters.`;
            const getStageFields = () => isBridal ? measurementSets[draft.garment][currentStage] : measurementSets[draft.garment];
            const collectMeasurements = () => {
                measurementValues = {
                    ...measurementValues,
                    ...Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, Number(value)]))
                };
            };
            const renderStage = () => {
                const measurementFields = getStageFields();
                const stageLabel = currentStage === 'vertical' ? 'Vertical Measurement' : 'Horizontal Measurement';
                stageTitle.textContent = isBridal ? stageLabel : 'Measurements';
                fields.innerHTML = measurementFields.map(([key, label]) => `<label class="block"><span class="mb-1 block text-[10px] uppercase tracking-[0.2em] text-brand-muted">${label}</span><input type="number" min="1" step="0.1" name="${key}" required value="${measurementValues[key] || ''}" placeholder="${label}" class="w-full border border-brand-border bg-brand-bg px-3.5 py-3 text-xs focus:border-brand-text focus:outline-none"></label>`).join('');
                nextMeasurementButton.classList.toggle('hidden', !isBridal || currentStage !== 'vertical');
                submitOrderButton.classList.toggle('hidden', isBridal && currentStage === 'vertical');
            };

            renderStage();

            document.getElementById('measurements-back-btn').addEventListener('click', () => {
                if (isBridal && currentStage === 'horizontal') {
                    collectMeasurements();
                    currentStage = 'vertical';
                    renderStage();
                    return;
                }
                if (window.history.length > 1) {
                    window.history.back();
                } else {
                    window.location.href = 'guest-order.html';
                }
            });

            nextMeasurementButton.addEventListener('click', () => {
                if (!form.reportValidity()) return;
                collectMeasurements();
                currentStage = 'horizontal';
                renderStage();
            });

            form.addEventListener('submit', async (event) => {
                event.preventDefault();
                if (!form.reportValidity()) return;
                submitOrderButton.disabled = true;
                submitOrderButton.textContent = 'Submitting...';
                collectMeasurements();
                const orderNumber = `RS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
                try {
                    await auth.authStateReady();
                    const userId = auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : null;
                    const order = {
                        orderNumber,
                        guestOrder: !userId,
                        userId,
                        customerName: draft.customerName,
                        customerPhone: draft.customerPhone,
                        gender: draft.gender,
                        garment: draft.garment,
                        occasion: draft.occasion,
                        designBrief: draft.designBrief,
                        measurements: measurementValues,
                        inspirationLinks: Array.isArray(draft.inspirationLinks)
                            ? draft.inspirationLinks
                            : draft.inspirationLinks?.split('\n').filter(Boolean) || [],
                        status: 'Received',
                        deliveryStatus: 'To be confirmed',
                        estimatedCompletionAt: null,
                        createdAt: serverTimestamp()
                    };
                    if (auth.currentUser?.email) order.customerEmail = auth.currentUser.email;
                    await setDoc(doc(db, 'orders', orderNumber), order);
                    sessionStorage.removeItem('remagstyle-order-draft');
                    message.innerHTML = `Your order has been submitted. Your order number is <strong>${orderNumber}</strong>. <a class="underline" href="track-order.html?order=${orderNumber}">Track this order</a>`;
                    message.className = 'border border-green-200 bg-green-50 p-3 text-[11px] text-green-800';
                    form.querySelectorAll('input, button').forEach((field) => { field.disabled = true; });
                } catch (error) {
                    message.textContent = 'We could not submit your order. Please try again.';
                    message.className = 'border border-red-200 bg-red-50 p-3 text-[11px] text-red-700';
                    submitOrderButton.disabled = false;
                    submitOrderButton.textContent = 'Submit Order';
                    console.error('Unable to submit order:', error);
                }
            });
        }