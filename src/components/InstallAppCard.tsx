import React, { useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';

/** Settings card for installing Monotask as an app. Renders nothing where installing isn't possible. */
const InstallAppCard: React.FC = () => {
  const { state, install } = useInstallPrompt();
  const [showIosSteps, setShowIosSteps] = useState(false);

  if (state === 'unavailable') return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Install App</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-medium text-foreground">
                {state === 'installed' ? 'Monotask is installed' : 'Add Monotask to your device'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {state === 'installed'
                  ? "You're running the installed app."
                  : 'Open it like any other app, in its own window, straight from your home screen.'}
              </p>
            </div>
            {state === 'promptable' && (
              <Button variant="outline" onClick={install} className="shrink-0">
                <Download className="w-4 h-4 mr-2" strokeWidth={2} />
                Install
              </Button>
            )}
            {state === 'ios-manual' && (
              <Button variant="outline" onClick={() => setShowIosSteps(true)} className="shrink-0">
                <Download className="w-4 h-4 mr-2" strokeWidth={2} />
                Install
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showIosSteps} onOpenChange={setShowIosSteps}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Home Screen</DialogTitle>
            <DialogDescription>
              iOS doesn't let apps install themselves, so it takes two taps in Safari.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-4 text-sm text-foreground">
            <li className="flex items-center gap-3">
              <Share className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span>
                Tap the <strong>Share</strong> button in Safari's toolbar.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <SquarePlus className="h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
              <span>
                Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>.
              </span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default InstallAppCard;
