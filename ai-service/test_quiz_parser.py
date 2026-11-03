from app.routers.quiz_gen import parse_quiz_response

sample = """
{
  "title": "Test Quiz",
  "questions": [
    {
      "question_text": "Q1",
      "question_type": "mcq",
      "options": [
        {"option_text": "A", "is_correct": true},
        {"option_text": "B", "is_correct": false},
        {"option_text": "C", "is_correct": false},
        {"option_text": "D", "is_correct": false}
      ]
    }
  ]},
  "questions": [
    {
      "question_text": "Q2",
      "question_type": "mcq",
      "options": [
        {"option_text": "A", "is_correct": true},
        {"option_text": "B", "is_correct": false},
        {"option_text": "C", "is_correct": false},
        {"option_text": "D", "is_correct": false}
      ]
    }
  ]
}
"""

try:
    result = parse_quiz_response(sample)
    print("Parser result:", len(result["questions"]))
    print("Parser test: PASS")
except Exception as error:
    print("Parser test: FAILED")
    print(type(error).__name__, str(error))
