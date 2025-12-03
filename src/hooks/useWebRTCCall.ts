import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

type CallState = "idle" | "calling" | "ringing" | "in-call";

interface UseWebRTCCallOptions {
  currentUserId: string;
  peerUserId: string;
  dmChannelId: string;
}

interface IncomingSignal {
  type: "offer" | "answer" | "candidate" | "hangup";
  from: string;
  sdp?: string;
  candidate?: RTCIceCandidateInit;
}

export const useWebRTCCall = ({
  currentUserId,
  peerUserId,
  dmChannelId,
}: UseWebRTCCallOptions) => {
  const [callState, setCallState] = useState<CallState>("idle");
  const [incoming, setIncoming] = useState<boolean>(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingOfferRef = useRef<IncomingSignal | null>(null);

  // --- helper: create PeerConnection, if not exists ---
  const ensurePeerConnection = () => {
    if (pcRef.current) return pcRef.current;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendSignal({
          type: "candidate",
          from: currentUserId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (stream) {
        setRemoteStream(stream);
      }
    };

    pcRef.current = pc;
    return pc;
  };

  // --- helper: send signal via supabase broadcast ---
  const sendSignal = (payload: IncomingSignal) => {
    const ch = channelRef.current;
    if (!ch) return;

    ch.send({
      type: "broadcast",
      event: "webrtc",
      payload,
    });
  };

  // --- subscribe to signaling channel ---
  useEffect(() => {
    if (!dmChannelId) return;

    const channel = supabase
      .channel(`webrtc-${dmChannelId}`, {
        config: {
          broadcast: { ack: true },
        },
      })
      .on("broadcast", { event: "webrtc" }, (event) => {
        const data = event.payload as IncomingSignal;
        if (!data || !data.type || data.from === currentUserId) return;

        switch (data.type) {
          case "offer":
            pendingOfferRef.current = data;
            setIncoming(true);
            setCallState("ringing");
            break;
          case "answer":
            if (pcRef.current && data.sdp) {
              pcRef.current.setRemoteDescription(
                new RTCSessionDescription({
                  type: "answer",
                  sdp: data.sdp,
                })
              );
              setCallState("in-call");
            }
            break;
          case "candidate":
            if (pcRef.current && data.candidate) {
              pcRef.current.addIceCandidate(
                new RTCIceCandidate(data.candidate)
              );
            }
            break;
          case "hangup":
            endCallInternal();
            break;
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch {
        // ignore
      }
      channelRef.current = null;
    };
  }, [dmChannelId, currentUserId]);

  // --- start local media (camera+mic) ---
  const startLocalMedia = async () => {
    if (localStream) return localStream;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });
    setLocalStream(stream);
    return stream;
  };

  // --- public: start a call ---
  const startCall = async () => {
    if (!dmChannelId) return;
    setCallState("calling");
    setIncoming(false);

    const stream = await startLocalMedia();
    const pc = ensurePeerConnection();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    sendSignal({
      type: "offer",
      from: currentUserId,
      sdp: offer.sdp || "",
    });
  };

  // --- public: accept incoming call ---
  const acceptCall = async () => {
    const incomingOffer = pendingOfferRef.current;
    if (!incomingOffer || !incomingOffer.sdp) return;

    setIncoming(false);

    const stream = await startLocalMedia();
    const pc = ensurePeerConnection();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    await pc.setRemoteDescription(
      new RTCSessionDescription({
        type: "offer",
        sdp: incomingOffer.sdp,
      })
    );

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    sendSignal({
      type: "answer",
      from: currentUserId,
      sdp: answer.sdp || "",
    });

    setCallState("in-call");
  };

  // --- public: reject incoming call ---
  const rejectCall = () => {
    pendingOfferRef.current = null;
    setIncoming(false);
    setCallState("idle");
    // Optional: you can also send a 'hangup' to notify caller
    sendSignal({ type: "hangup", from: currentUserId });
  };

  // --- internal: end call, clean streams + pc ---
  const endCallInternal = () => {
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.close();
    }
    pcRef.current = null;

    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
    }
    setLocalStream(null);
    setRemoteStream(null);

    pendingOfferRef.current = null;
    setIncoming(false);
    setCallState("idle");
  };

  // --- public: end call (and notify peer) ---
  const endCall = () => {
    sendSignal({ type: "hangup", from: currentUserId });
    endCallInternal();
  };

  // clean on unmount
  useEffect(() => {
    return () => {
      endCallInternal();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    callState,
    incoming,
    localStream,
    remoteStream,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
};
