// Service to manage review history in localStorage

import { AIAnalysisResult, RepoInfo } from '../types';

export interface SavedReview {
  id: string;
  repoFullName: string;
  repoOwner: string;
  repoName: string;
  repoUrl: string;
  reviewMarkdown: string;
  aiAnalysis: AIAnalysisResult | null;
  savedAt: string; // ISO date string
  commitCount: number;
  prCount: number;
}

const STORAGE_KEY = 'review_history';

export const ReviewHistoryService = {
  /**
   * Get all saved reviews from localStorage
   */
  getAll(): SavedReview[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to load review history:', e);
      return [];
    }
  },

  /**
   * Get a specific review by ID
   */
  getById(id: string): SavedReview | null {
    const reviews = this.getAll();
    return reviews.find(r => r.id === id) || null;
  },

  /**
   * Save a new review or update existing one for the same repo
   */
  save(
    repoInfo: RepoInfo,
    reviewMarkdown: string,
    aiAnalysis: AIAnalysisResult | null,
    commitCount: number,
    prCount: number
  ): SavedReview {
    const reviews = this.getAll();
    
    const newReview: SavedReview = {
      id: `${repoInfo.full_name}-${Date.now()}`,
      repoFullName: repoInfo.full_name,
      repoOwner: repoInfo.owner.login,
      repoName: repoInfo.name,
      repoUrl: repoInfo.html_url,
      reviewMarkdown,
      aiAnalysis,
      savedAt: new Date().toISOString(),
      commitCount,
      prCount
    };

    // Add to beginning of array (most recent first)
    reviews.unshift(newReview);

    // Keep only last 50 reviews to avoid localStorage size limits
    const trimmedReviews = reviews.slice(0, 50);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedReviews));
    } catch (e) {
      console.error('Failed to save review:', e);
      // If storage is full, try removing old reviews
      if (e instanceof DOMException && e.name === 'QuotaExceededError') {
        const smallerList = trimmedReviews.slice(0, 20);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(smallerList));
      }
    }

    return newReview;
  },

  /**
   * Delete a review by ID
   */
  delete(id: string): void {
    const reviews = this.getAll();
    const filtered = reviews.filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  },

  /**
   * Clear all review history
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
};
