import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { PhoneOff, PhoneCall } from "lucide-react";

interface CallOverlayProps {
  open: boolean;
  onClose: () => void;
  callState: "idle" | "calling" | "ringing" | "in-call";
  incoming: boolean;
  friendName: string;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  onAccept: () => void;
  onReject: () => void;
  onHangup: () => void;
}

const CallOverlay = ({
  open,
  onClose,
  callState,
  incoming,
  friendName,
  localStream,
  remoteStream,
  onAccept,
  onReject,
  onHangup,
}: CallOverlayProps) => {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  if (!open) return null;

  const title =
    callState === "calling"
      ? `Calling ${friendName}…`
      : callState === "ringing"
      ? `${friendName} is calling…`
      : callState === "in-call"
      ? `In call with ${friendName}`
      : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="w-full max-w-lg rounded-2xl glass-card border border-cyan-500/60 p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-cyan-100">{title}</h2>
          <button
            onClick={() => {
              onHangup();
              onClose();
            }}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            <PhoneOff className="inline h-4 w-4 mr-1" />
            Hang up
          </button>
        </div>

        {/* Video area */}
        <div className="grid grid-cols-2 gap-2 mb-2 h-48">
          <div className="relative bg-black/70 rounded-xl overflow-hidden border border-white/20">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 left-2 text-xs text-slate-200 bg-black/50 px-2 py-[2px] rounded-full">
              {friendName}
            </div>
          </div>
          <div className="relative bg-black/70 rounded-xl overflow-hidden border border-white/20">
            <video
              ref={localVideoRef}
              muted
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-1 left-2 text-xs text-slate-200 bg-black/50 px-2 py-[2px] rounded-full">
              You
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3 mt-1">
          {incoming && callState === "ringing" ? (
            <>
              <Button
                className="bg-emerald-500 hover:bg-emerald-400"
                onClick={onAccept}
              >
                <PhoneCall className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  onReject();
                  onClose();
                }}
              >
                <PhoneOff className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              onClick={() => {
                onHangup();
                onClose();
              }}
            >
              <PhoneOff className="h-4 w-4 mr-1" />
              End Call
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;  // 👈 VERY IMPORTANT
