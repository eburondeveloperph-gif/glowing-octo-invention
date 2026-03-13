/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import './WelcomeScreen.css';
import { useLogStore } from '../../../lib/state';

const WelcomeScreen: React.FC = () => {
  const turns = useLogStore(state => state.turns);
  const lastTurn = turns.at(-1);

  // Find the most recent agent (translation) turn to display.
  const lastAgentTurn = [...turns].reverse().find(turn => turn.role === 'agent');

  // If there's no translated text yet, render nothing at all.
  if (!lastAgentTurn) {
    return null;
  }

  // The cursor should only show if the *very last* turn is the agent turn and it's not final.
  const showCursor = lastTurn?.role === 'agent' && !lastTurn.isFinal;

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="translation-output-container">
          <div className="transcript-display agent-transcript">
            <p className="transcript-text">
              {lastAgentTurn.text}
              {showCursor && <span className="cursor"></span>}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
