from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db import get_db
import traceback
from app.services.logout import logout


router = APIRouter()


@router.post("/post")
def logout_user(refresh_token: str, db: Session = Depends(get_db)):
    try:
        resultado_logout = logout(db, refresh_token)
        return resultado_logout
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        print(f"Error al hacer logout")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))