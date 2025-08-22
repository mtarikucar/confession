import { useState } from 'react';
import './ConfessionForm.css';

interface ConfessionFormProps {
  socket: any;
  isRenewal?: boolean;
  onSubmitted?: () => void;
}

function ConfessionForm({ socket, isRenewal = false, onSubmitted }: ConfessionFormProps) {
  const [confession, setConfession] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!confession.trim()) {
      setError('Please write a confession');
      return;
    }

    if (confession.length < 10) {
      setError('Confession must be at least 10 characters');
      return;
    }

    try {
      setIsSubmitting(true);
      setError('');
      await socket.submitConfession(confession);
      if (onSubmitted) {
        onSubmitted();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit confession');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="confession-form-container">
      <h2>{isRenewal ? 'Your Confession Was Revealed! Write a New One' : 'Submit Your Confession'}</h2>
      <p className="confession-info">
        {isRenewal 
          ? 'Your previous confession was revealed. You need a new secret to continue playing!'
          : 'Your confession will remain hidden unless you lose a game!'}
      </p>
      
      <form onSubmit={handleSubmit} className="confession-form">
        <textarea
          placeholder="Write your confession here... It could be embarrassing, funny, or a secret you've never told anyone!"
          value={confession}
          onChange={(e) => setConfession(e.target.value)}
          maxLength={500}
          rows={6}
          className="confession-textarea"
          disabled={isSubmitting}
        />
        
        <div className="char-count">
          {confession.length}/500 characters
        </div>
        
        {error && <div className="error">{error}</div>}
        
        <button 
          type="submit" 
          className="submit-btn"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Submitting...' : 'Submit Confession'}
        </button>
        
        <p className="warning">
          ⚠️ Remember: If you lose a game, everyone will see this!
        </p>
      </form>
    </div>
  );
}

export default ConfessionForm;