import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { McpSettingsTab } from "../settings/McpSettingsTab";

type McpServersModalProps = {
  open: boolean;
  onClose: () => void;
  workspaceRoot: string | null;
};

export function McpServersModal({ open, onClose, workspaceRoot }: McpServersModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-[700px] h-[500px] bg-card rounded-lg shadow-modal flex flex-col p-4 border border-secondary"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-semibold text-foreground">MCP Servers</h2>
              <button
                onClick={onClose}
                className="p-1 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <McpSettingsTab workspaceRoot={workspaceRoot} />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
