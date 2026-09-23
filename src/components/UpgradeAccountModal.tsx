import React, { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface UpgradeAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SPRING_SNAPPY = { type: 'spring' as const, stiffness: 300, damping: 30 };

const UpgradeAccountModal = ({ open, onOpenChange }: UpgradeAccountModalProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { linkEmailPassword } = useAuth();
  const shouldReduceMotion = useReducedMotion();

  const handleUpgrade = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await linkEmailPassword(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success('Account created! Please check your email to confirm.');
        onOpenChange(false);
      }
    } catch (err) {
      toast.error('Failed to upgrade account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Floating overlay layer: a tasteful glass surface with a solid fallback for
          prefers-reduced-transparency, plus a bouncier entrance than the stock dialog
          fade (the shared Dialog primitive's own animate-in classes are left intact
          to avoid touching a component other surfaces also depend on). */}
      <DialogContent
        className="sm:max-w-md !duration-300 data-[state=open]:[animation-timing-function:cubic-bezier(0.34,1.56,0.64,1)] bg-background/90 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-0 border border-border/80 shadow-2xl shadow-brand/5"
      >
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <motion.div
              initial={shouldReduceMotion ? undefined : { scale: 0.5, opacity: 0 }}
              animate={shouldReduceMotion ? undefined : { scale: 1, opacity: 1 }}
              transition={{ ...SPRING_SNAPPY, delay: 0.05 }}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 shrink-0"
            >
              <UserPlus className="h-4 w-4 text-brand" strokeWidth={2} />
            </motion.div>
            <DialogTitle className="font-grotesk">Create your account</DialogTitle>
          </div>
          <DialogDescription>
            Add an email and password to save your data permanently. All your existing tasks and habits will be kept.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleUpgrade} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <motion.div
              className="flex-1"
              whileHover={shouldReduceMotion || loading ? undefined : { scale: 1.02 }}
              whileTap={shouldReduceMotion || loading ? undefined : { scale: 0.97 }}
              transition={SPRING_SNAPPY}
            >
              <Button
                type="submit"
                disabled={loading}
                className="w-full shadow-[0_0_0_0_hsl(var(--brand)/0.5)] hover:shadow-[0_0_20px_-2px_hsl(var(--brand)/0.5)] transition-shadow duration-300"
              >
                {loading ? 'Creating...' : 'Create Account'}
              </Button>
            </motion.div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeAccountModal;
