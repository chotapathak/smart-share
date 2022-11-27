// Import the functions we need from the SDKs 
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, query, collection, addDoc, updateDoc, deleteDoc } from  'firebase/firestore'

//  web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBf1BZNC7sJs--W8FDI2EA5odXkz3CAMRk",
  authDomain: "shareme-365616.firebaseapp.com",
  projectId: "shareme-365616",
  storageBucket: "shareme-365616.appspot.com",
  messagingSenderId: "840303189638",
  appId: "1:840303189638:web:b593ece5f35c9d647afb07",
  measurementId: "G-1TYKZCHR6Z"
};

// Initialize Firebase
const fireApp = initializeApp(firebaseConfig);
const firestore = getFirestore(fireApp);

// Initialize the iceServers
const servers = {
    iceServers : [
        {
            urls: [ 'stun:stun.l.google.com:19302', 
                    'stun:stun1.l.google.com:19302']
        }
    ],
    iceCandidatePoolSize: 10
}

// Create a new RTCPeerConnection with server
export const peerConnection = new RTCPeerConnection(servers);

export async function createOffer() {
    // Database reference 'call' objects
    const callDocs = collection(firestore, 'calls')
    
    // Create a new call object
    const newDoc = await addDoc(callDocs, {})

    // Put call ID to offerInput
    const offerInput = document.querySelector('#offerInput') as HTMLInputElement;
    offerInput.value = newDoc.id;

    // Offer and answer candidates collections
    const offerCandidates = collection(newDoc, 'offerCandidates')
    const answerCandidates = collection(newDoc, 'answerCandidates')

    // Listen for ICE candidates and add them to the offerCandidates collection
    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            addDoc(offerCandidates, event.candidate.toJSON())
        }
    }

    // Create an offer and set it as the local description
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    // Create offer SDP to upload to Firestore
    const offerSDP = {
        type: offerDescription.type,
        sdp: offerDescription.sdp
    }

    // Add offer SDP to Firestore
    await updateDoc(newDoc, { offerSDP })


    // Listen for remote SDP and set it as the remote description
    onSnapshot(newDoc, snapshot => {
        const remoteData = snapshot.data()

        // If there is no remote description set and answer is ready
        if (!peerConnection.currentRemoteDescription && remoteData?.answerSDP) {
            // Set remote description
            peerConnection.setRemoteDescription(new RTCSessionDescription(remoteData?.answerSDP))
        }
    })

    // Listen for remote ICE answer candidates
    onSnapshot(answerCandidates, snapshot => {
        // Track changes in the collection
        snapshot.docChanges().forEach(change => {
            // If there is a new candidate, add it to the peerConnection
            if (change.type === 'added') {
                const newCandidate = new RTCIceCandidate(change.doc.data())
                peerConnection.addIceCandidate(newCandidate)
            }
        })
    })
}