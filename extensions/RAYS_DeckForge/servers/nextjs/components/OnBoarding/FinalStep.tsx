import { ArrowRight, PartyPopper } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useState } from 'react'
import { Switch } from '../ui/switch';
import confetti from 'canvas-confetti';
import { getApiUrl } from '@/utils/api';

const CONFETTI_COLORS = ['#ffffff', '#888888', '#383838', '#1d1d1d'];

function fireRealisticConfetti() {
    confetti({
        particleCount: 300,
        spread: 360,
        origin: { x: 0.5, y: 0.5 },
        colors: CONFETTI_COLORS,
        startVelocity: 60,
        scalar: 1.8,
        gravity: 0.6,
        ticks: 300,
        decay: 0.93,
        zIndex: 9999,
    });
}

const FinalStep = () => {
    const router = useRouter()
    const pathname = usePathname()
    const [trackingEnabled, setTrackingEnabled] = useState<boolean | null>(null);

    useEffect(() => {
        fireRealisticConfetti();
    }, []);

    useEffect(() => {
        async function fetchStatus() {
            try {
        const data = await fetch(getApiUrl('/api/v1/auth/telemetry-status')).then((res) => res.json());
                setTrackingEnabled(data.telemetryEnabled);
            } catch {
                setTrackingEnabled(true);
            }
        }
        fetchStatus();
    }, []);

    const handleTrackingToggle = useCallback(async (enabled: boolean) => {
        const prev = trackingEnabled;
        setTrackingEnabled(enabled);
        try {
      await fetch(getApiUrl('/api/v1/auth/user-config'), {
        method: 'POST',
        body: JSON.stringify({
          DISABLE_ANONYMOUS_TRACKING: enabled ? undefined : 'true',
        }),
      });
        } catch {
            setTrackingEnabled(prev);
        }
    }, [trackingEnabled]);

    const handleGoToDashboard = () => {
        router.push('/dashboard')
    }
    const handleGoToUpload = () => {
        router.push('/upload')
    }
    return (
        <div className='fixed top-0 left-0 w-full h-full flex flex-col items-center justify-center' style={{ background: '#000000' }}>
            <div className='flex flex-col items-center justify-center'>

                <img src="/final_onboarding.png" alt="RAYS DeckForge" className='w-[118px] h-[98px] object-contain' />
                <h1 className='text-[30px] font-normal py-2.5' style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>Welcome on board!</h1>
                <p className='text-xl font-normal' style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>You're all set. Let's create your first presentation.</p>

                {trackingEnabled !== null && (
                    <div className='flex items-center gap-3 mt-8 px-5 py-3.5 rounded-[10px]' style={{ border: '1px solid #383838', background: '#1d1d1d' }}>
                        <div>
                            <p className='text-sm font-medium' style={{ color: '#ffffff', fontFamily: "'Space Mono', monospace" }}>Usage analytics</p>
                            <p className='text-[11px] leading-tight mt-0.5' style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>Help improve RAYS DeckForge by sharing anonymous usage data.</p>
                        </div>
                        <Switch
                            checked={trackingEnabled}
                            onCheckedChange={handleTrackingToggle}
                            className='data-[state=checked]:bg-[#ffffff]'
                        />
                    </div>
                )}

                <button onClick={handleGoToUpload} className='px-[23px] mt-8 py-[15px] rounded-[10px] text-lg font-semibold' style={{ background: '#ffffff', color: '#000000', fontFamily: "'Space Mono', monospace" }}>My First Presentation 🚀</button>
                <button onClick={fireRealisticConfetti} className='mt-3 flex items-center gap-1.5 text-sm font-medium hover:underline' style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>
                    <PartyPopper className='w-4 h-4' /> Celebrate again!
                </button>
            </div>
            <button onClick={handleGoToDashboard} className='absolute uppercase bottom-20 flex items-center gap-2 right-10 text-xs font-normal' style={{ color: '#888888', fontFamily: "'Space Mono', monospace" }}>Go to your dashboard <ArrowRight className='w-4 h-4' style={{ color: '#888888' }} /></button>
        </div>
    )
}

export default FinalStep
