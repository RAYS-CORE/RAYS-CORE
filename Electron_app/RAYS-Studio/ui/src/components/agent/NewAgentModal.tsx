import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { hostListAgentProfiles, hostCreateAgentProfile } from "@/services/platformHost";
import { createAgentSession, type AgentSession } from "@/services/agentSessionStorage";
import { Loader2 } from "lucide-react";

export const AGENT_NAME_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

type NewAgentModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: (session: AgentSession) => void;
};

export function NewAgentModal({ open, onClose, onCreated }: NewAgentModalProps) {
  const [name, setName] = useState("");
  const [cloneFrom, setCloneFrom] = useState<string>("default");
  const [soul, setSoul] = useState("");
  const [existingProfiles, setExistingProfiles] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      hostListAgentProfiles().then(profiles => {
        setExistingProfiles(profiles);
        if (profiles.length === 0) {
          setCloneFrom("");
        } else if (!profiles.includes("default") && profiles.length > 0) {
          setCloneFrom(profiles[0]);
        }
      }).catch(err => {
        console.error("Failed to list profiles:", err);
      });
      // Reset form
      setName("");
      setSoul("");
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!AGENT_NAME_RE.test(trimmed)) {
      setError("Name must start with a letter/number and contain only lowercase letters, numbers, hyphens, or underscores.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const path = await hostCreateAgentProfile(trimmed, cloneFrom || null, soul || null);
      const session = createAgentSession(path);
      onCreated(session);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[425px] border-rays-pink/20 bg-background">
        <DialogHeader>
          <DialogTitle>New Agent</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              placeholder="my-new-agent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-card"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clone-from">Clone from</Label>
            <Select value={cloneFrom} onValueChange={setCloneFrom}>
              <SelectTrigger id="clone-from" className="bg-card">
                <SelectValue placeholder="Select an agent to clone..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">(None - Blank Agent)</SelectItem>
                {existingProfiles.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-soul">rays_attitude.md (Optional)</Label>
            <Textarea
              id="agent-soul"
              placeholder="The system prompt / persona for this profile. Leave blank to keep the cloned default."
              value={soul}
              onChange={(e) => setSoul(e.target.value)}
              className="min-h-[120px] bg-card resize-none font-mono text-sm"
            />
          </div>

          {error && <div className="text-sm text-red-500 font-medium">{error}</div>}

          <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name.trim()} className="bg-rays-violet hover:bg-rays-violet/90">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Agent
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
