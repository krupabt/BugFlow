import os
import csv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from models.issue import Issue

class ResolutionRecommender:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            stop_words="english",
            max_features=5000,
            ngram_range=(1, 2)
        )
        self.corpus_docs = []
        self.corpus_issues = []
        self.tfidf_matrix = None
        self._is_fitted = False
        
    def _load_corpus(self):
        # 1. Try to load historical issues from PostgreSQL
        issues = []
        try:
            db_issues = Issue.query.filter(
                (Issue.is_historical == True) | (Issue.status.in_(["Resolved", "Closed"]))
            ).limit(2500).all()
            for i in db_issues:
                issues.append({
                    "id": i.id,
                    "issue_key": i.issue_key,
                    "title": i.title,
                    "description": i.description or "",
                    "status": i.status,
                    "priority": i.priority,
                    "severity": i.severity,
                    "resolution": i.resolution or "Resolved",
                    "project": i.project.name if i.project else "Apache"
                })
        except Exception:
            pass

        # 2. If database is not populated yet, load from dataset/apache_jira_sample.csv
        if not issues:
            csv_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
                "dataset",
                "apache_jira_sample.csv"
            )
            if os.path.exists(csv_path):
                with open(csv_path, mode="r", encoding="utf-8", errors="replace") as f:
                    reader = csv.DictReader(f)
                    for idx, row in enumerate(reader):
                        if idx >= 1500:  # limit for speed and memory
                            break
                        issues.append({
                            "id": idx + 1,
                            "issue_key": row.get("issue_key", f"APACHE-{idx+1}"),
                            "title": row.get("title", ""),
                            "description": row.get("description", ""),
                            "status": row.get("status", "Resolved"),
                            "priority": row.get("priority", "Major"),
                            "severity": row.get("severity", "Medium"),
                            "resolution": row.get("resolution", "Fixed"),
                            "project": row.get("project", "Apache")
                        })
                        
        self.corpus_issues = issues
        self.corpus_docs = [
            f"{item['title']} {item['description']}".strip() for item in issues
        ]
        
        if self.corpus_docs:
            self.tfidf_matrix = self.vectorizer.fit_transform(self.corpus_docs)
            self._is_fitted = True

    def find_similar_issues(self, query_title, query_description="", top_k=3, min_similarity=0.10):
        query_text = f"{query_title} {query_description}".strip()
        if not query_text:
            return {
                "results": [],
                "disclaimer": "Please provide an issue title or description to analyze.",
                "total_historical_searched": 0
            }
            
        if not self._is_fitted or not self.corpus_issues:
            self._load_corpus()
            
        if not self._is_fitted or not self.corpus_issues:
            return {
                "results": [],
                "disclaimer": "Historical issue corpus is not available yet. Please run the dataset import script.",
                "total_historical_searched": 0
            }
            
        # Transform the query
        query_vec = self.vectorizer.transform([query_text])
        similarities = cosine_similarity(query_vec, self.tfidf_matrix).flatten()
        
        # Get top-k indices
        top_indices = similarities.argsort()[::-1]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score < min_similarity:
                break
            issue = self.corpus_issues[idx].copy()
            issue["similarity_score"] = round(score * 100, 1)  # percentage
            results.append(issue)
            if len(results) >= top_k:
                break
                
        return {
            "results": results,
            "disclaimer": "Resolution suggestions are recommendations based on statistical text similarity (TF-IDF + Cosine Similarity) and are not guaranteed fixes.",
            "total_historical_searched": len(self.corpus_issues)
        }

recommender = ResolutionRecommender()
