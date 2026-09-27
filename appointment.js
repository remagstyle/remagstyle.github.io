import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
        import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
        import { getFirestore, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

        const app = initializeApp({ apiKey: "AIzaSyCzcxTLAUH83sQsia4dPg5py19YzRsmw0o", authDomain: "remagstyle-43b41.firebaseapp.com", projectId: "remagstyle-43b41", messagingSenderId: "145831201308", appId: "1:145831201308:web:489a014516356f73a72dd9" });
        const db = getFirestore(app);
        const auth = getAuth(app);
        const appointmentForm = document.getElementById('appointment-form');
        const appointmentStatus = document.getElementById('appointment-message-status');

        appointmentForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const submitButton = appointmentForm.querySelector('button[type="submit"]');
            const name = document.getElementById('appointment-name').value.trim();
            const email = document.getElementById('appointment-email').value.trim();
            const phone = document.getElementById('appointment-phone').value.trim();
            const date = document.getElementById('appointment-date').value;
            const time = document.getElementById('appointment-time').value;
            const service = document.getElementById('appointment-service').value;
            const message = document.getElementById('appointment-message').value.trim() || 'No additional details provided.';
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';
            try {
                await addDoc(collection(db, 'appointments'), {
                    customerName: name,
                    customerEmail: email,
                    customerPhone: phone,
                    preferredDate: date,
                    preferredTime: time,
                    service,
                    message,
                    status: 'New',
                    createdAt: serverTimestamp()
                });
                appointmentForm.reset();
                appointmentStatus.textContent = 'Your appointment request has been received. We will reply shortly.';
                appointmentStatus.className = 'p-3 text-[11px] bg-green-50 border border-green-200 text-green-700';
            } catch (error) {
                appointmentStatus.textContent = 'We could not send your request right now. Please try again.';
                appointmentStatus.className = 'p-3 text-[11px] bg-red-50 border border-red-200 text-red-700';
                console.error('Unable to save appointment:', error);
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Send Appointment Request';
            }
        });

        setTimeout(() => {
            const appointmentForm = document.getElementById('appointment-form');
            if (appointmentForm && window.scrollY < 120) {
                appointmentForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 9000);