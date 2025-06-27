def gen_prompt(lesson_block, student_choice, student_traits,tone):
    """
    Generate a prompt for Spacey's AI response for a children's lesson engine.
    
    Args:
        lesson_block (str): Description of the lesson scenario (e.g., about spaghettification).
        student_choice (str): The student's chosen action or answer.
        student_traits (list): List of student traits (e.g., ["curious", "cautious"]).
        tone (str): Desired tone (e.g., "supportive but slightly cheeky").
    
    Returns:
        str: Formatted prompt string.
    """
    traits_str = ", ".join(student_traits) if student_traits else "none"
    prompt = (
        f"You are Spacey, a clever, witty, and kind AI assistant teaching young children about space science, "
        f"inspired by Baymax and JARVIS. The lesson is about: {lesson_block}. "
        f"The student chose: {student_choice}. "
        f"Student traits: {traits_str}. "
        f"Respond in a {tone} tone, using simple, age-appropriate words for kids aged 6-10. "
        f"Keep the response short (2-4 sentences), fun, and educational. "
        f"Reflect the student's choice and traits, and explain a space science concept clearly."
    )
    return prompt