import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
        import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
        import { getFirestore, setDoc, doc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";
        const app = initializeApp({ apiKey: "AIzaSyCzcxTLAUH83sQsia4dPg5py19YzRsmw0o", authDomain: "remagstyle-43b41.firebaseapp.com", projectId: "remagstyle-43b41", messagingSenderId: "145831201308", appId: "1:145831201308:web:489a014516356f73a72dd9" });
        const auth = getAuth(app);
        const db = getFirestore(app);
        const form = document.getElementById('guest-order-form');
        const message = document.getElementById('order-message');
        const stepOne = document.getElementById('order-step-1');
        const stepTwo = document.getElementById('order-step-2');
        const gender = document.getElementById('guest-gender');
        const garment = document.getElementById('order-garment');
        const stepTwoFields = stepTwo.querySelectorAll('input, select, textarea');
        const measurementGarments = ['Trousers', 'Shirts (Long & Short)', 'Suits', 'Kaftan/Agbada', 'Bridal Couture', 'Red Carpet Dresses', 'Prom Dress', 'Corset Dresses', 'Slit and Kaba'];
        const garmentOptions = {
            Male: ['Trousers', 'Shirts (Long & Short)', 'Suits', 'Kaftan/Agbada'],
            Female: ['Bridal Couture', 'Red Carpet Dresses', 'Prom Dress', 'Corset Dresses', 'Slit and Kaba'],
            Other: ['Custom Bespoke Design', 'Kente Ensemble', 'Evening Wear']
        };

        function updateGarmentOptions() {
            garment.innerHTML = '<option value="">Select a garment</option>';
            (garmentOptions[gender.value] || []).forEach((option) => {
                garment.insertAdjacentHTML('beforeend', `<option>${option}</option>`);
            });
        }

        function updateMeasurementFlow() {
            const usesMeasurementPage = measurementGarments.includes(garment.value);
            document.getElementById('guest-measurements-next-btn').classList.toggle('hidden', !usesMeasurementPage);
            document.getElementById('guest-submit-btn').classList.toggle('hidden', usesMeasurementPage);
        }

        stepTwoFields.forEach((field) => { field.disabled = true; });

        document.getElementById('guest-next-btn').addEventListener('click', () => {
            if (!document.getElementById('guest-name').reportValidity() || !document.getElementById('guest-phone').reportValidity() || !gender.reportValidity()) return;
            updateGarmentOptions();
            stepTwoFields.forEach((field) => { field.disabled = false; });
            stepOne.classList.add('hidden');
            stepTwo.classList.remove('hidden');
        });
        document.getElementById('guest-back-btn').addEventListener('click', () => {
            stepTwoFields.forEach((field) => { field.disabled = true; });
            stepTwo.classList.add('hidden');
            stepOne.classList.remove('hidden');
        });
        gender.addEventListener('change', updateGarmentOptions);
        gender.addEventListener('change', updateMeasurementFlow);
        garment.addEventListener('change', updateMeasurementFlow);

        document.getElementById('guest-measurements-next-btn').addEventListener('click', async () => {
            if (!garment.reportValidity() || !document.getElementById('order-occasion').reportValidity() || !document.getElementById('order-notes').reportValidity()) return;
            try {
                const userId = auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : null;
                sessionStorage.setItem('remagstyle-order-draft', JSON.stringify({
                    customerName: document.getElementById('guest-name').value.trim(),
                    customerPhone: document.getElementById('guest-phone').value.trim(),
                    gender: gender.value,
                    garment: garment.value,
                    occasion: document.getElementById('order-occasion').value.trim(),
                    designBrief: document.getElementById('order-notes').value.trim(),
                    inspirationLinks: document.getElementById('order-inspiration').value.trim(),
                    userId
                }));
                window.location.href = 'measurements.html';
            } catch (error) {
                message.textContent = error.message || 'We could not prepare your order. Please try again.';
                message.className = 'border border-red-200 bg-red-50 p-4 text-[11px] text-red-700';
            }
        });

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const button = document.getElementById('guest-submit-btn');
            button.disabled = true;
            button.textContent = 'Submitting...';
            const orderNumber = `RS-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
            try {
                const userId = auth.currentUser && !auth.currentUser.isAnonymous ? auth.currentUser.uid : null;
                await setDoc(doc(db, 'orders', orderNumber), { orderNumber, guestOrder: true, userId, customerName: document.getElementById('guest-name').value.trim(), customerPhone: document.getElementById('guest-phone').value.trim(), gender: gender.value, garment: garment.value, occasion: document.getElementById('order-occasion').value.trim(), designBrief: document.getElementById('order-notes').value.trim(), measurements: {}, inspirationLinks: document.getElementById('order-inspiration').value.trim().split('\n').filter(Boolean), status: 'Received', deliveryStatus: 'To be confirmed', estimatedCompletionAt: null, createdAt: serverTimestamp() });
                form.reset();
                updateGarmentOptions();
                updateMeasurementFlow();
                stepTwoFields.forEach((field) => { field.disabled = true; });
                stepTwo.classList.add('hidden');
                stepOne.classList.remove('hidden');
                message.className = 'border border-green-200 bg-green-50 p-4 text-[11px] text-green-800';
                message.innerHTML = `Your request has been received. Your order number is <strong>${orderNumber}</strong>. <a class="underline" href="track-order.html?order=${orderNumber}">Track this order</a>`;
            } catch (error) {
                message.textContent = error.code === 'permission-denied'
                    ? 'Firebase security rules are blocking guest orders. Allow unauthenticated guest orders to create order documents with userId set to null, then try again.'
                    : 'We could not submit your order. Please try again.';
                message.className = 'border border-red-200 bg-red-50 p-4 text-[11px] text-red-700';
                console.error('Unable to submit guest order:', error);
            } finally { button.disabled = false; button.textContent = 'Submit Guest Order'; }
        });